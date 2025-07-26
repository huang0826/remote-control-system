package com.remotecontrol.client.data.repository

import com.remotecontrol.client.data.local.DeviceDao
import com.remotecontrol.client.data.model.*
import com.remotecontrol.client.network.DeviceApi
import kotlinx.coroutines.flow.Flow

class DeviceRepository(
    private val deviceApi: DeviceApi,
    private val deviceDao: DeviceDao
) {
    
    fun getAllDevices(): Flow<List<Device>> = deviceDao.getAllDevices()
    
    suspend fun registerDevice(request: DeviceRegisterRequest): Result<DeviceResponse> {
        return try {
            val response = deviceApi.registerDevice(request)
            if (response.isSuccessful && response.body()?.success == true) {
                response.body()?.data?.let { deviceResponse ->
                    deviceDao.insertDevice(deviceResponse.device)
                }
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "设备注册失败"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun getDevice(deviceId: String): Result<Device> {
        return try {
            val response = deviceApi.getDevice(deviceId)
            if (response.isSuccessful && response.body()?.success == true) {
                response.body()?.data?.let { device ->
                    deviceDao.insertDevice(device)
                }
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "获取设备信息失败"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun updateDevice(deviceId: String, request: UpdateDeviceRequest): Result<Device> {
        return try {
            val response = deviceApi.updateDevice(deviceId, request)
            if (response.isSuccessful && response.body()?.success == true) {
                response.body()?.data?.let { device ->
                    deviceDao.updateDevice(device)
                }
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "更新设备信息失败"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun sendHeartbeat(deviceId: String, request: HeartbeatRequest): Result<Unit> {
        return try {
            val response = deviceApi.sendHeartbeat(deviceId, request)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.body()?.message ?: "发送心跳失败"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun updateLocation(deviceId: String, request: LocationRequest): Result<Unit> {
        return try {
            val response = deviceApi.updateLocation(deviceId, request)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.body()?.message ?: "更新位置失败"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun getLocationHistory(
        deviceId: String,
        startTime: String? = null,
        endTime: String? = null
    ): Result<List<LocationHistory>> {
        return try {
            val response = deviceApi.getLocationHistory(deviceId, startTime, endTime)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "获取位置历史失败"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun getControlledDevices(): Result<List<Device>> {
        return try {
            val response = deviceApi.getControlledDevices()
            if (response.isSuccessful && response.body()?.success == true) {
                response.body()?.data?.forEach { device ->
                    deviceDao.insertDevice(device)
                }
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "获取可控制设备失败"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun addDeviceControl(deviceId: String, request: AddControlRequest): Result<Unit> {
        return try {
            val response = deviceApi.addDeviceControl(deviceId, request)
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.body()?.message ?: "添加设备控制关系失败"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}