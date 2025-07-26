package com.remotecontrol.client.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.remotecontrol.client.data.model.User
import com.remotecontrol.client.data.model.Device

@Database(
    entities = [User::class, Device::class],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    
    abstract fun userDao(): UserDao
    abstract fun deviceDao(): DeviceDao
    
    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null
        
        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "remote_control_database"
                ).build()
                INSTANCE = instance
                instance
            }
        }
    }
}