package com.remotecontrol.client.data.repository

import com.remotecontrol.client.data.local.UserDao
import com.remotecontrol.client.data.model.*
import com.remotecontrol.client.network.UserApi
import kotlinx.coroutines.flow.Flow

class UserRepository(
    private val userApi: UserApi,
    private val userDao: UserDao
) {
    
    fun getCurrentUser(): Flow<User?> = userDao.getCurrentUser()
    
    suspend fun register(request: RegisterRequest): Result<UserResponse> {
        return try {
            val response = userApi.register(request)
            if (response.isSuccessful && response.body()?.success == true) {
                response.body()?.data?.let { userResponse ->
                    userDao.insertUser(userResponse.user)
                }
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "注册失败"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun login(request: LoginRequest): Result<LoginResponse> {
        return try {
            val response = userApi.login(request)
            if (response.isSuccessful && response.body()?.success == true) {
                response.body()?.data?.let { loginResponse ->
                    userDao.insertUser(loginResponse.user)
                }
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "登录失败"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun logout(): Result<Unit> {
        return try {
            val response = userApi.logout()
            if (response.isSuccessful && response.body()?.success == true) {
                userDao.deleteAllUsers()
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.body()?.message ?: "登出失败"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun getProfile(): Result<UserProfile> {
        return try {
            val response = userApi.getProfile()
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "获取用户信息失败"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun updateProfile(request: UpdateProfileRequest): Result<UserProfile> {
        return try {
            val response = userApi.updateProfile(request)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "更新用户信息失败"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun changePassword(request: ChangePasswordRequest): Result<Unit> {
        return try {
            val response = userApi.changePassword(request)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.body()?.message ?: "修改密码失败"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}