package com.margelo.nitro.nitroota

import android.content.Context
import android.util.Log
import androidx.work.Worker
import androidx.work.WorkerParameters
import com.margelo.nitro.core.Promise
import kotlinx.coroutines.runBlocking

class BackgroundTaskWorker(
    context: Context,
    workerParams: WorkerParameters
) : Worker(context, workerParams) {

    companion object {
        const val TAG = "BackgroundTaskWorker"
        const val TASK_ID = "com.pikachu.NitroOta.backgroundOTA"
        
        // Store callbacks for pending work (async callbacks that return Promise<Promise<Unit>>)
        private val callbacks = mutableMapOf<String, () -> Promise<Promise<Unit>>>()
        
        fun registerCallback(workId: String, callback: () -> Promise<Promise<Unit>>) {
            callbacks[workId] = callback
        }
        
        fun unregisterCallback(workId: String) {
            callbacks.remove(workId)
        }
    }

    override fun doWork(): Result {
        val workId = inputData.getString("work_id") ?: return Result.failure()
        
        Log.d(TAG, "Background task executing (Task ID: $TASK_ID, Work ID: $workId)")
        
        return try {
            // Retrieve and execute the async callback
            val callback = callbacks[workId]
            if (callback != null) {
                Log.d(TAG, "Executing async callback for work ID: $workId")
                
                // Execute the callback and wait for the double-wrapped promise to complete
                runBlocking {
                    try {
                        // First await returns Promise<Unit>, then await that
                        val innerPromise = callback().await()
                        innerPromise.await()
                        Log.d(TAG, "Async callback completed successfully")
                    } catch (e: Exception) {
                        Log.e(TAG, "Async callback failed", e)
                        throw e
                    }
                }
                
                unregisterCallback(workId)
                Log.d(TAG, "Background task completed successfully")
                Result.success()
            } else {
                Log.w(TAG, "No callback found for work ID: $workId")
                Result.failure()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error executing background task", e)
            Result.failure()
        }
    }
}

