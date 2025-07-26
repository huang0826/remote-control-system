package com.remotecontrol.client.data.model

import com.google.gson.annotations.SerializedName

data class AppUsageRecord(
    @SerializedName("id")
    val id: Int,
    @SerializedName("package_name")
    val packageName: String,
    @SerializedName("app_name")
    val appName: String,
    @SerializedName("start_time")
    val startTime: String,
    @SerializedName("end_time")
    val endTime: String? = null,
    @SerializedName("duration")
    val duration: Int? = null
)

data class AppUsageTrackingRequest(
    @SerializedName("action")
    val action: String // "start" or "stop"
)

data class InstalledApp(
    @SerializedName("package_name")
    val packageName: String,
    @SerializedName("app_name")
    val appName: String,
    @SerializedName("version_name")
    val versionName: String,
    @SerializedName("version_code")
    val versionCode: Int,
    @SerializedName("install_time")
    val installTime: Long,
    @SerializedName("is_system_app")
    val isSystemApp: Boolean,
    @SerializedName("is_hidden")
    val isHidden: Boolean = false
)

data class AppVisibilityRequest(
    @SerializedName("package_name")
    val packageName: String,
    @SerializedName("action")
    val action: String // "hide" or "show"
)

data class AppUsageStats(
    @SerializedName("total_apps")
    val totalApps: Int,
    @SerializedName("hidden_apps")
    val hiddenApps: Int,
    @SerializedName("daily_usage")
    val dailyUsage: List<DailyUsage>,
    @SerializedName("top_apps")
    val topApps: List<TopApp>
)

data class DailyUsage(
    @SerializedName("date")
    val date: String,
    @SerializedName("total_time")
    val totalTime: Int // 分钟
)

data class TopApp(
    @SerializedName("package_name")
    val packageName: String,
    @SerializedName("app_name")
    val appName: String,
    @SerializedName("usage_time")
    val usageTime: Int // 分钟
)