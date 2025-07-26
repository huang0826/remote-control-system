package com.remotecontrol.client.network

import com.remotecontrol.client.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface DeviceApi {
    
    @POST("devices/register")
    suspend fun registerDevice(@Body request: DeviceRegisterRequest): Response<ApiResponse<DeviceResponse>>
    
    @GET("devices/{deviceId}")
    suspend fun getDevice(@Path("deviceId") deviceId: String): Response<ApiResponse<Device>>
    
    @PUT("devices/{deviceId}")
    suspend fun updateDevice(
        @Path("deviceId") deviceId: String,
        @Body request: UpdateDeviceRequest
    ): Response<ApiResponse<Device>>
    
    @POST("devices/{deviceId}/heartbeat")
    suspend fun sendHeartbeat(
        @Path("deviceId") deviceId: String,
        @Body request: HeartbeatRequest
    ): Response<ApiResponse<Any>>
    
    @POST("devices/{deviceId}/location")
    suspend fun updateLocation(
        @Path("deviceId") deviceId: String,
        @Body request: LocationRequest
    ): Response<ApiResponse<Any>>
    
    @GET("devices/{deviceId}/location/history")
    suspend fun getLocationHistory(
        @Path("deviceId") deviceId: String,
        @Query("start_time") startTime: String?,
        @Query("end_time") endTime: String?
    ): Response<ApiResponse<List<LocationHistory>>>
    
    @GET("devices/controlled")
    suspend fun getControlledDevices(): Response<ApiResponse<List<Device>>>
    
    @POST("devices/{deviceId}/control")
    suspend fun addDeviceControl(
        @Path("deviceId") deviceId: String,
        @Body request: AddControlRequest
    ): Response<ApiResponse<Any>>
}