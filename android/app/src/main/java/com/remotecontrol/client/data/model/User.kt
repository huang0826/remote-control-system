package com.remotecontrol.client.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.google.gson.annotations.SerializedName

@Entity(tableName = "users")
data class User(
    @PrimaryKey
    @SerializedName("id")
    val id: Int,
    @SerializedName("phone")
    val phone: String,
    @SerializedName("nickname")
    val nickname: String,
    @SerializedName("avatar")
    val avatar: String? = null,
    @SerializedName("agent_id")
    val agentId: Int? = null,
    @SerializedName("created_at")
    val createdAt: String
)

data class RegisterRequest(
    @SerializedName("phone")
    val phone: String,
    @SerializedName("password")
    val password: String,
    @SerializedName("nickname")
    val nickname: String,
    @SerializedName("agent_code")
    val agentCode: String? = null
)

data class LoginRequest(
    @SerializedName("phone")
    val phone: String,
    @SerializedName("password")
    val password: String
)

data class LoginResponse(
    @SerializedName("token")
    val token: String,
    @SerializedName("user")
    val user: User
)

data class UserResponse(
    @SerializedName("user")
    val user: User
)

data class UserProfile(
    @SerializedName("id")
    val id: Int,
    @SerializedName("phone")
    val phone: String,
    @SerializedName("nickname")
    val nickname: String,
    @SerializedName("avatar")
    val avatar: String? = null
)

data class UpdateProfileRequest(
    @SerializedName("nickname")
    val nickname: String,
    @SerializedName("avatar")
    val avatar: String? = null
)

data class ChangePasswordRequest(
    @SerializedName("old_password")
    val oldPassword: String,
    @SerializedName("new_password")
    val newPassword: String
)