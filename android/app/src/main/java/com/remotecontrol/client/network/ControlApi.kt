package com.remotecontrol.client.network

import com.remotecontrol.client.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface ControlApi {
    
    @POST("control/{deviceId}/photo")
    suspend fun takePhoto(
        @Path("deviceId") deviceId: String,
        @Body request: PhotoRequest
    ): Response<ApiResponse<TaskResponse>>
    
    @POST("control/{deviceId}/audio")
    suspend fun recordAudio(
        @Path("deviceId") deviceId: String,
        @Body request: AudioRequest
    ): Response<ApiResponse<TaskResponse>>
    
    @POST("control/{deviceId}/video")
    suspend fun recordVideo(
        @Path("deviceId") deviceId: String,
        @Body request: VideoRequest
    ): Response<ApiResponse<TaskResponse>>
    
    @POST("control/{deviceId}/live-audio/start")
    suspend fun startLiveAudio(
        @Path("deviceId") deviceId: String
    ): Response<ApiResponse<TaskResponse>>
    
    @POST("control/{deviceId}/live-audio/stop")
    suspend fun stopLiveAudio(
        @Path("deviceId") deviceId: String
    ): Response<ApiResponse<Any>>
    
    @POST("control/{deviceId}/live-video/start")
    suspend fun startLiveVideo(
        @Path("deviceId") deviceId: String
    ): Response<ApiResponse<TaskResponse>>
    
    @POST("control/{deviceId}/live-video/stop")
    suspend fun stopLiveVideo(
        @Path("deviceId") deviceId: String
    ): Response<ApiResponse<Any>>
    
    @POST("control/{deviceId}/camera/switch")
    suspend fun switchCamera(
        @Path("deviceId") deviceId: String,
        @Body request: SwitchCameraRequest
    ): Response<ApiResponse<Any>>
    
    @GET("control/{deviceId}/calls")
    suspend fun getCallHistory(
        @Path("deviceId") deviceId: String
    ): Response<ApiResponse<List<CallRecord>>>
}