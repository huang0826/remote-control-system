package com.remotecontrol.client.network

import com.remotecontrol.client.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface AppApi {
    
    @GET("app/usage/{deviceId}")
    suspend fun getAppUsageRecords(
        @Path("deviceId") deviceId: String
    ): Response<ApiResponse<List<AppUsageRecord>>>
    
    @POST("app/usage/{deviceId}")
    suspend fun toggleAppUsageTracking(
        @Path("deviceId") deviceId: String,
        @Body request: AppUsageTrackingRequest
    ): Response<ApiResponse<Any>>
    
    @GET("app/installed/{deviceId}")
    suspend fun getInstalledApps(
        @Path("deviceId") deviceId: String
    ): Response<ApiResponse<List<InstalledApp>>>
    
    @POST("app/visibility/{deviceId}")
    suspend fun toggleAppVisibility(
        @Path("deviceId") deviceId: String,
        @Body request: AppVisibilityRequest
    ): Response<ApiResponse<Any>>
    
    @GET("app/stats/{deviceId}")
    suspend fun getAppUsageStats(
        @Path("deviceId") deviceId: String
    ): Response<ApiResponse<AppUsageStats>>
}