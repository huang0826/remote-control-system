package com.remotecontrol.client.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.google.gson.annotations.SerializedName

@Entity(tableName = "devices")
data class Device(
    @PrimaryKey
    @SerializedName("device_id")
    val deviceId: String,
    @SerializedName("device_name")
    val deviceName: String,
    @SerializedName("device_model")
    val deviceModel: String,
    @SerializedName("android_version")
    val androidVersion: String,
    @SerializedName("app_version")
    val appVersion: String,
    @SerializedName("is_online")
    val isOnline: Boolean,
    @SerializedName("last_seen")
    val lastSeen: String,
    @SerializedName("battery_level")
    val batteryLevel: Int? = null,
    @SerializedName("location")
    val location: String? = null,
    @SerializedName("created_at")
    val createdAt: String
)

data class DeviceRegisterRequest(
    @SerializedName("device_id")
    val deviceId: String,
    @SerializedName("device_name")
    val deviceName: String,
    @SerializedName("device_model")
    val deviceModel: String,
    @SerializedName("android_version")
    val androidVersion: String,
    @SerializedName("app_version")
    val appVersion: String
)

data class DeviceResponse(
    @SerializedName("device")
    val device: Device,
    @SerializedName("token")
    val token: String
)

data class UpdateDeviceRequest(
    @SerializedName("device_name")
    val deviceName: String? = null,
    @SerializedName("battery_level")
    val batteryLevel: Int? = null
)

data class HeartbeatRequest(
    @SerializedName("battery_level")
    val batteryLevel: Int,
    @SerializedName("is_charging")
    val isCharging: Boolean,
    @SerializedName("network_type")
    val networkType: String
)

data class LocationRequest(
    @SerializedName("latitude")
    val latitude: Double,
    @SerializedName("longitude")
    val longitude: Double,
    @SerializedName("accuracy")
    val accuracy: Float,
    @SerializedName("timestamp")
    val timestamp: Long
)

data class LocationHistory(
    @SerializedName("id")
    val id: Int,
    @SerializedName("latitude")
    val latitude: Double,
    @SerializedName("longitude")
    val longitude: Double,
    @SerializedName("accuracy")
    val accuracy: Float,
    @SerializedName("timestamp")
    val timestamp: String
)

data class AddControlRequest(
    @SerializedName("target_user_id")
    val targetUserId: Int
)