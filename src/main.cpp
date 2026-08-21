#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Arduino.h>
#include <Wire.h>
#include <math.h>

#define I2C_SDA 8
#define I2C_SCL 9
#define MPU_ADDRESS 0x68
#define ACCEL_CORRECTION_GAIN 0.05f
#define GRAVITY_ACCELERATION 9.80665f
#define ACCELERATION_TOLERANCE 2.0f

Adafruit_MPU6050 mpu;

struct Quaternion {
  float w;
  float x;
  float y;
  float z;
};

Quaternion identityQuaternion() { return {1.0f, 0.0f, 0.0f, 0.0f}; }

Quaternion multiplyQuaternions(const Quaternion &left,
                               const Quaternion &right) {
  return {
      left.w * right.w - left.x * right.x - left.y * right.y - left.z * right.z,
      left.w * right.x + left.x * right.w + left.y * right.z - left.z * right.y,
      left.w * right.y - left.x * right.z + left.y * right.w + left.z * right.x,
      left.w * right.z + left.x * right.y - left.y * right.x +
          left.z * right.w};
}

void normalizeQuaternion(Quaternion &quaternion) {
  const float magnitude =
      sqrtf(quaternion.w * quaternion.w + quaternion.x * quaternion.x +
            quaternion.y * quaternion.y + quaternion.z * quaternion.z);

  if (magnitude <= 0.0f) {
    quaternion = identityQuaternion();
    return;
  }

  quaternion.w /= magnitude;
  quaternion.x /= magnitude;
  quaternion.y /= magnitude;
  quaternion.z /= magnitude;
}

Quaternion orientation = identityQuaternion();
unsigned long previousUpdateMicros;

Quaternion conjugateQuaternion(const Quaternion &quaternion) {
  return {quaternion.w, -quaternion.x, -quaternion.y, -quaternion.z};
}

void quaternionToEulerDegrees(const Quaternion &quaternion, float &roll,
                              float &pitch, float &yaw) {
  const float rollRadians =
      atan2f(2.0f * (quaternion.w * quaternion.x + quaternion.y * quaternion.z),
             1.0f - 2.0f * (quaternion.x * quaternion.x +
                            quaternion.y * quaternion.y));
  const float pitchInput =
      2.0f * (quaternion.w * quaternion.y - quaternion.z * quaternion.x);
  const float pitchRadians = asinf(constrain(pitchInput, -1.0f, 1.0f));
  const float yawRadians =
      atan2f(2.0f * (quaternion.w * quaternion.z + quaternion.x * quaternion.y),
             1.0f - 2.0f * (quaternion.y * quaternion.y +
                            quaternion.z * quaternion.z));
  const float radiansToDegrees = 180.0f / PI;

  roll = rollRadians * radiansToDegrees;
  pitch = pitchRadians * radiansToDegrees;
  yaw = yawRadians * radiansToDegrees;
}

void calculateExpectedBodyUp(float &expectedX, float &expectedY,
                             float &expectedZ) {
  const Quaternion worldUp = {0.0f, 0.0f, 0.0f, 1.0f};
  const Quaternion expectedBodyUp = multiplyQuaternions(
      multiplyQuaternions(conjugateQuaternion(orientation), worldUp),
      orientation);

  expectedX = expectedBodyUp.x;
  expectedY = expectedBodyUp.y;
  expectedZ = expectedBodyUp.z;
}

bool applyAccelerometerCorrection(const sensors_event_t &accel,
                                  float &accelerationMagnitude,
                                  float &measuredX, float &measuredY,
                                  float &measuredZ, float &expectedX,
                                  float &expectedY, float &expectedZ) {
  const float accelerationX = accel.acceleration.x;
  const float accelerationY = accel.acceleration.y;
  const float accelerationZ = accel.acceleration.z;
  accelerationMagnitude =
      sqrtf(accelerationX * accelerationX + accelerationY * accelerationY +
            accelerationZ * accelerationZ);

  if (fabsf(accelerationMagnitude - GRAVITY_ACCELERATION) >
      ACCELERATION_TOLERANCE) {
    calculateExpectedBodyUp(expectedX, expectedY, expectedZ);
    measuredX = 0.0f;
    measuredY = 0.0f;
    measuredZ = 0.0f;
    return false;
  }

  const float measuredMagnitudeInverse = 1.0f / accelerationMagnitude;
  measuredX = accelerationX * measuredMagnitudeInverse;
  measuredY = accelerationY * measuredMagnitudeInverse;
  measuredZ = accelerationZ * measuredMagnitudeInverse;
  calculateExpectedBodyUp(expectedX, expectedY, expectedZ);

  const float correctionX = expectedY * measuredZ - expectedZ * measuredY;
  const float correctionY = expectedZ * measuredX - expectedX * measuredZ;
  const float correctionZ = expectedX * measuredY - expectedY * measuredX;

  const Quaternion correction = {1.0f,
                                 0.5f * ACCEL_CORRECTION_GAIN * correctionX,
                                 0.5f * ACCEL_CORRECTION_GAIN * correctionY,
                                 0.5f * ACCEL_CORRECTION_GAIN * correctionZ};
  orientation = multiplyQuaternions(orientation, correction);
  normalizeQuaternion(orientation);
  return true;
}

void setup() {
  Serial.begin(9600);
  delay(1000);

  Wire.begin(I2C_SDA, I2C_SCL);

  if (!mpu.begin(MPU_ADDRESS, &Wire)) {
    Serial.println("MPU6050 FAILED");
    while (true) {
      delay(1000);
    }
  }

  Serial.println("MPU6050 OK");

  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

  delay(500);

  Serial.println("ax,ay,az,gx,gy,gz");
  Serial.println("Q,w,x,y,z");
  Serial.println("A,ax,ay,az,amag");
  Serial.println("G,gx,gy,gz");
  Serial.println("C,accepted");
  Serial.println("V,mx,my,mz,ex,ey,ez");
  previousUpdateMicros = micros();
}

void loop() {
  sensors_event_t accel;
  sensors_event_t gyro;
  sensors_event_t temp;

  mpu.getEvent(&accel, &gyro, &temp);

  const unsigned long currentUpdateMicros = micros();
  const float deltaTime =
      (currentUpdateMicros - previousUpdateMicros) * 0.000001f;
  previousUpdateMicros = currentUpdateMicros;

  const Quaternion angularVelocity = {0.0f, gyro.gyro.x, gyro.gyro.y,
                                      gyro.gyro.z};
  const Quaternion quaternionDerivative =
      multiplyQuaternions(orientation, angularVelocity);

  orientation.w += 0.5f * quaternionDerivative.w * deltaTime;
  orientation.x += 0.5f * quaternionDerivative.x * deltaTime;
  orientation.y += 0.5f * quaternionDerivative.y * deltaTime;
  orientation.z += 0.5f * quaternionDerivative.z * deltaTime;
  normalizeQuaternion(orientation);
  float accelerationMagnitude;
  float measuredX;
  float measuredY;
  float measuredZ;
  float expectedX;
  float expectedY;
  float expectedZ;
  const bool correctionAccepted = applyAccelerometerCorrection(
      accel, accelerationMagnitude, measuredX, measuredY, measuredZ, expectedX,
      expectedY, expectedZ);

  Serial.print("A,");
  Serial.print(accel.acceleration.x, 3);
  Serial.print(",");
  Serial.print(accel.acceleration.y, 3);
  Serial.print(",");
  Serial.print(accel.acceleration.z, 3);
  Serial.print(",");
  Serial.println(accelerationMagnitude, 3);

  Serial.print("G,");
  Serial.print(gyro.gyro.x, 3);
  Serial.print(",");
  Serial.print(gyro.gyro.y, 3);
  Serial.print(",");
  Serial.println(gyro.gyro.z, 3);

  Serial.print("C,");
  Serial.println(correctionAccepted ? "accepted" : "rejected");

  Serial.print("V,");
  Serial.print(measuredX, 3);
  Serial.print(",");
  Serial.print(measuredY, 3);
  Serial.print(",");
  Serial.print(measuredZ, 3);
  Serial.print(",");
  Serial.print(expectedX, 3);
  Serial.print(",");
  Serial.print(expectedY, 3);
  Serial.print(",");
  Serial.println(expectedZ, 3);

  Serial.print("Q,");
  Serial.print(orientation.w, 3);
  Serial.print(",");
  Serial.print(orientation.x, 3);
  Serial.print(",");
  Serial.print(orientation.y, 3);
  Serial.print(",");
  Serial.println(orientation.z, 3);

  float roll;
  float pitch;
  float yaw;
  quaternionToEulerDegrees(orientation, roll, pitch, yaw);

  Serial.print("E,");
  Serial.print(roll, 2);
  Serial.print(",");
  Serial.print(pitch, 2);
  Serial.print(",");
  Serial.println(yaw, 2);

  delay(100);
}