package com.remotecontrol.client.data.local

import androidx.room.*
import com.remotecontrol.client.data.model.Device
import kotlinx.coroutines.flow.Flow

@Dao
interface DeviceDao {
    
    @Query("SELECT * FROM devices")
    fun getAllDevices(): Flow<List<Device>>
    
    @Query("SELECT * FROM devices WHERE device_id = :deviceId")
    suspend fun getDeviceById(deviceId: String): Device?
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDevice(device: Device)
    
    @Update
    suspend fun updateDevice(device: Device)
    
    @Delete
    suspend fun deleteDevice(device: Device)
    
    @Query("DELETE FROM devices")
    suspend fun deleteAllDevices()
}