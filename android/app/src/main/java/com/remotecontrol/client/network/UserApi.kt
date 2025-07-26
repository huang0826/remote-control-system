package com.remotecontrol.client.network

import com.remotecontrol.client.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface UserApi {
    
    @POST("users/register")
    suspend fun register(@Body request: RegisterRequest): Response<ApiResponse<UserResponse>>
    
    @POST("users/login")
    suspend fun login(@Body request: LoginRequest): Response<ApiResponse<LoginResponse>>
    
    @POST("users/logout")
    suspend fun logout(): Response<ApiResponse<Any>>
    
    @GET("users/profile")
    suspend fun getProfile(): Response<ApiResponse<UserProfile>>
    
    @PUT("users/profile")
    suspend fun updateProfile(@Body request: UpdateProfileRequest): Response<ApiResponse<UserProfile>>
    
    @POST("users/change-password")
    suspend fun changePassword(@Body request: ChangePasswordRequest): Response<ApiResponse<Any>>
}