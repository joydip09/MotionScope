#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Arduino.h>
#include <Wire.h>
#include <math.h>


#define I2C_SDA 8
#define I2C_SCL 9
#define MPU_ADDRESS 0x68

#define WARMUP_DURATION_MS 120000
#define CALIBRATION_DURATION_MS 10000

#define SAMPLE_INTERVAL_US 10000
#define REPORT_INTERVAL_MS 500

#define FILTER_COUNT 5

const float alphaValues[FILTER_COUNT] = {0.90f, 0.95f, 0.98f, 0.99f, 0.995f};

Adafruit_MPU6050 mpu;

float gyroBiasX = 0.0f;
float gyroBiasY = 0.0f;
float gyroBiasZ = 0.0f;

float gyroRoll = 0.0f;
float gyroPitch = 0.0f;

float fusedRoll[FILTER_COUNT] = {};
float fusedPitch[FILTER_COUNT] = {};

unsigned long lastSampleMicros = 0;
unsigned long lastReportMillis = 0;

void warmUpSensor() {
  Serial.println("===== SENSOR WARM-UP =====");
  Serial.println("Keep the MPU6050 completely stationary.");
  Serial.println("Waiting 2 minutes for thermal stabilization.");
  Serial.println();

  unsigned long startTime = millis();
  unsigned long lastReport = startTime;

  while (millis() - startTime < WARMUP_DURATION_MS) {
    unsigned long elapsed = millis() - startTime;

    if (elapsed >= (lastReport - startTime) + 10000) {
      sensors_event_t accel;
      sensors_event_t gyro;
      sensors_event_t temperature;

      mpu.getEvent(&accel, &gyro, &temperature);

      unsigned long remaining = (WARMUP_DURATION_MS - elapsed) / 1000;

      Serial.print("Warm-up remaining: ");
      Serial.print(remaining);
      Serial.print(" s | Temperature: ");
      Serial.print(temperature.temperature, 2);
      Serial.println(" C");

      lastReport = millis();
    }

    delay(10);
  }

  Serial.println();
  Serial.println("Warm-up complete.");
  Serial.println();
}

void calibrateGyroscope() {
  double sumX = 0.0;
  double sumY = 0.0;
  double sumZ = 0.0;

  unsigned long sampleCount = 0;
  unsigned long startTime = millis();
  unsigned long nextSample = micros();

  Serial.println("===== GYROSCOPE CALIBRATION =====");
  Serial.println("Keep the MPU6050 completely stationary.");
  Serial.println("Calibration duration: 10 seconds.");
  Serial.println();

  while (millis() - startTime < CALIBRATION_DURATION_MS) {
    while ((long)(micros() - nextSample) < 0) {
      yield();
    }

    nextSample += SAMPLE_INTERVAL_US;

    sensors_event_t accel;
    sensors_event_t gyro;
    sensors_event_t temperature;

    mpu.getEvent(&accel, &gyro, &temperature);

    sumX += gyro.gyro.x;
    sumY += gyro.gyro.y;
    sumZ += gyro.gyro.z;

    sampleCount++;
  }

  gyroBiasX = sumX / sampleCount;
  gyroBiasY = sumY / sampleCount;
  gyroBiasZ = sumZ / sampleCount;

  Serial.println();
  Serial.println("Calibration complete.");
  Serial.println();

  Serial.print("Samples: ");
  Serial.println(sampleCount);

  Serial.print("Gyro Bias X: ");
  Serial.print(gyroBiasX, 7);
  Serial.println(" rad/s");

  Serial.print("Gyro Bias Y: ");
  Serial.print(gyroBiasY, 7);
  Serial.println(" rad/s");

  Serial.print("Gyro Bias Z: ");
  Serial.print(gyroBiasZ, 7);
  Serial.println(" rad/s");

  Serial.println();
}

void calculateAccelerometerAngles(float ax, float ay, float az, float &roll,
                                  float &pitch) {
  roll = atan2(ay, az);

  pitch = atan2(-ax, sqrt(ay * ay + az * az));
}

void printHeader() {
  Serial.println();
  Serial.println("===== FILTER COMPARISON =====");
  Serial.println();

  Serial.println("Roll values:");

  Serial.println("Gyro | Accel | A0.90 | A0.95 | A0.98 | A0.99 | A0.995");

  Serial.println("-------------------------------------------------------");

  Serial.println("Pitch values:");

  Serial.println("Gyro | Accel | A0.90 | A0.95 | A0.98 | A0.99 | A0.995");

  Serial.println("-------------------------------------------------------");
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("===== MOTIONSCOPE PHASE 5B =====");
  Serial.println("Complementary Filter Alpha Experiment");
  Serial.println();

  Wire.begin(I2C_SDA, I2C_SCL);

  if (!mpu.begin(MPU_ADDRESS, &Wire)) {
    Serial.println("MPU6050 initialization failed!");

    while (true) {
      delay(1000);
    }
  }

  Serial.println("MPU6050 initialized successfully.");

  mpu.setAccelerometerRange(MPU6050_RANGE_2_G);
  mpu.setGyroRange(MPU6050_RANGE_250_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

  Serial.println("Accelerometer: ±2G");
  Serial.println("Gyroscope: ±250 deg/s");
  Serial.println("Filter: 21 Hz");

  Serial.println();
  Serial.println("Alpha values:");

  for (int i = 0; i < FILTER_COUNT; i++) {
    Serial.print("α");
    Serial.print(i);
    Serial.print(": ");
    Serial.println(alphaValues[i], 3);
  }

  Serial.println();

  warmUpSensor();
  calibrateGyroscope();

  gyroRoll = 0.0f;
  gyroPitch = 0.0f;

  for (int i = 0; i < FILTER_COUNT; i++) {
    fusedRoll[i] = 0.0f;
    fusedPitch[i] = 0.0f;
  }

  lastSampleMicros = micros();
  lastReportMillis = millis();

  printHeader();

  Serial.println();
  Serial.println("Keep the sensor stationary first.");
  Serial.println("Then perform the same three-axis rotations.");
  Serial.println();
}

void loop() {
  unsigned long nowMicros = micros();

  if ((long)(nowMicros - lastSampleMicros) < SAMPLE_INTERVAL_US) {
    return;
  }

  float dt = (nowMicros - lastSampleMicros) / 1000000.0f;

  lastSampleMicros = nowMicros;

  sensors_event_t accel;
  sensors_event_t gyro;
  sensors_event_t temperature;

  mpu.getEvent(&accel, &gyro, &temperature);

  float correctedX = gyro.gyro.x - gyroBiasX;

  float correctedY = gyro.gyro.y - gyroBiasY;

  float accelRoll;
  float accelPitch;

  calculateAccelerometerAngles(accel.acceleration.x, accel.acceleration.y,
                               accel.acceleration.z, accelRoll, accelPitch);

  gyroRoll += correctedX * dt;
  gyroPitch += correctedY * dt;

  for (int i = 0; i < FILTER_COUNT; i++) {
    float alpha = alphaValues[i];

    fusedRoll[i] =
        alpha * (fusedRoll[i] + correctedX * dt) + (1.0f - alpha) * accelRoll;

    fusedPitch[i] =
        alpha * (fusedPitch[i] + correctedY * dt) + (1.0f - alpha) * accelPitch;
  }

  if (millis() - lastReportMillis >= REPORT_INTERVAL_MS) {
    float gyroRollDeg = gyroRoll * 180.0f / PI;

    float gyroPitchDeg = gyroPitch * 180.0f / PI;

    float accelRollDeg = accelRoll * 180.0f / PI;

    float accelPitchDeg = accelPitch * 180.0f / PI;

    Serial.print("R ");
    Serial.print(gyroRollDeg, 2);
    Serial.print(" | ");
    Serial.print(accelRollDeg, 2);

    for (int i = 0; i < FILTER_COUNT; i++) {
      Serial.print(" | ");
      Serial.print(fusedRoll[i] * 180.0f / PI, 2);
    }

    Serial.println();

    Serial.print("P ");
    Serial.print(gyroPitchDeg, 2);
    Serial.print(" | ");
    Serial.print(accelPitchDeg, 2);

    for (int i = 0; i < FILTER_COUNT; i++) {
      Serial.print(" | ");
      Serial.print(fusedPitch[i] * 180.0f / PI, 2);
    }

    Serial.println();

    lastReportMillis = millis();
  }
}