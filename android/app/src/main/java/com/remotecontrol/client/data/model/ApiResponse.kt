package com.remotecontrol.client.data.model

import com.google.gson.annotations.SerializedName

data class ApiResponse<T>(
    @SerializedName("success")
    val success: Boolean,
    @SerializedName("message")
    val message: String,
    @SerializedName("data")
    val data: T? = null,
    @SerializedName("error")
    val error: String? = null
)

data class TaskResponse(
    @SerializedName("task_id")
    val taskId: String,
    @SerializedName("status")
    val status: String
)