package com.remotecontrol.client.data.local

import androidx.room.*
import com.remotecontrol.client.data.model.User
import kotlinx.coroutines.flow.Flow

@Dao
interface UserDao {
    
    @Query("SELECT * FROM users WHERE id = :id")
    suspend fun getUserById(id: Int): User?
    
    @Query("SELECT * FROM users LIMIT 1")
    fun getCurrentUser(): Flow<User?>
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertUser(user: User)
    
    @Update
    suspend fun updateUser(user: User)
    
    @Delete
    suspend fun deleteUser(user: User)
    
    @Query("DELETE FROM users")
    suspend fun deleteAllUsers()
}