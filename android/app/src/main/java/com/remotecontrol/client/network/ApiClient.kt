package com.remotecontrol.client.network

import android.content.Context
import com.remotecontrol.client.utils.PreferenceManager
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {
    // 移除硬编码的BASE_URL
    // private const val BASE_URL = "http://your-server-url:3000/api/"
    
    private lateinit var context: Context
    private lateinit var retrofit: Retrofit
    
    // API接口实例
    lateinit var userApi: UserApi
    lateinit var deviceApi: DeviceApi
    lateinit var controlApi: ControlApi
    lateinit var appApi: AppApi
    
    fun initialize(context: Context) {
        this.context = context
        createRetrofitInstance()
    }
    
    fun updateServerUrl() {
        if (::context.isInitialized) {
            createRetrofitInstance()
        }
    }
    
    private fun createRetrofitInstance() {
        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
        
        val authInterceptor = Interceptor { chain ->
            val token = PreferenceManager.getToken(context)
            val request = if (token.isNotEmpty()) {
                chain.request().newBuilder()
                    .addHeader("Authorization", "Bearer $token")
                    .build()
            } else {
                chain.request()
            }
            chain.proceed(request)
        }
        
        val client = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(loggingInterceptor)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
        
        // 从PreferenceManager获取服务器地址
        val serverUrl = PreferenceManager.getServerUrl(context)
        val baseUrl = "$serverUrl/api/"
        
        retrofit = Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        
        // 初始化API接口
        userApi = retrofit.create(UserApi::class.java)
        deviceApi = retrofit.create(DeviceApi::class.java)
        controlApi = retrofit.create(ControlApi::class.java)
        appApi = retrofit.create(AppApi::class.java)
    }
}