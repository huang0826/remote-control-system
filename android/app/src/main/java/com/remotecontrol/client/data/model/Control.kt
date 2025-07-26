package com.remotecontrol.client.data.model

import com.google.gson.annotations.SerializedName

data class PhotoRequest(
    @SerializedName("camera")
    val camera: String = "back", // "front" or "back"
    @SerializedName("quality")
    val quality: String = "high" // "low", "medium", "high"
)

data class AudioRequest(
    @SerializedName("duration")
    val duration: Int, // 录音时长（秒）
    @SerializedName("quality")
    val quality: String = "high"
)

data class VideoRequest(
    @SerializedName("duration")
    val duration: Int, // 录像时长（秒）
    @SerializedName("camera")
    val camera: String = "back",
    @SerializedName("quality")
    val quality: String = "high"
)

data class SwitchCameraRequest(
    @SerializedName("camera")
    val camera: String // "front" or "back"
)

data class CallRecord(
    @SerializedName("id")
    val id: Int,
    @SerializedName("type")
    val type: String, // "audio" or "video"
    @SerializedName("duration")
    val duration: Int,
    @SerializedName("start_time")
    val startTime: String,
    @SerializedName("end_time")
    val endTime: String,
    @SerializedName("file_url")
    val fileUrl: String? = null
)