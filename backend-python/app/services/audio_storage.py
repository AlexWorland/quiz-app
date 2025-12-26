"""Audio chunk storage service using MinIO."""
from uuid import UUID

import aioboto3
from botocore.exceptions import ClientError

from app.config import get_settings

settings = get_settings()


class AudioStorageService:
    """Service for storing and retrieving audio chunks in MinIO."""
    
    def __init__(self):
        self.session = aioboto3.Session()
        self.bucket = "audio-chunks"
    
    async def store_chunk(
        self,
        segment_id: UUID,
        chunk_index: int,
        audio_data: bytes
    ) -> str:
        """Store an audio chunk in MinIO.
        
        Args:
            segment_id: Segment UUID
            chunk_index: Chunk number (0-based)
            audio_data: Raw audio bytes
            
        Returns:
            Storage path (key) in MinIO
            
        Raises:
            Exception: If storage fails
        """
        storage_path = f"{segment_id}/chunk_{chunk_index:04d}.webm"
        
        async with self.session.client(
            's3',
            endpoint_url=f"http://{settings.minio_endpoint}",
            aws_access_key_id=settings.minio_access_key,
            aws_secret_access_key=settings.minio_secret_key,
            use_ssl=settings.minio_use_ssl,
        ) as s3:
            await s3.put_object(
                Bucket=self.bucket,
                Key=storage_path,
                Body=audio_data,
                ContentType='audio/webm'
            )
        
        return storage_path
    
    async def retrieve_chunk(self, storage_path: str) -> bytes:
        """Retrieve an audio chunk from MinIO.
        
        Args:
            storage_path: MinIO key/path
            
        Returns:
            Audio chunk bytes
            
        Raises:
            ClientError: If chunk doesn't exist
        """
        async with self.session.client(
            's3',
            endpoint_url=f"http://{settings.minio_endpoint}",
            aws_access_key_id=settings.minio_access_key,
            aws_secret_access_key=settings.minio_secret_key,
            use_ssl=settings.minio_use_ssl,
        ) as s3:
            response = await s3.get_object(Bucket=self.bucket, Key=storage_path)
            async with response['Body'] as stream:
                return await stream.read()
    
    async def delete_segment_chunks(self, segment_id: UUID) -> int:
        """Delete all chunks for a segment.
        
        Args:
            segment_id: Segment UUID
            
        Returns:
            Number of chunks deleted
        """
        prefix = f"{segment_id}/"
        
        async with self.session.client(
            's3',
            endpoint_url=f"http://{settings.minio_endpoint}",
            aws_access_key_id=settings.minio_access_key,
            aws_secret_access_key=settings.minio_secret_key,
            use_ssl=settings.minio_use_ssl,
        ) as s3:
            # List all objects with prefix
            response = await s3.list_objects_v2(Bucket=self.bucket, Prefix=prefix)
            objects = response.get('Contents', [])
            
            # Delete all
            if objects:
                await s3.delete_objects(
                    Bucket=self.bucket,
                    Delete={
                        'Objects': [{'Key': obj['Key']} for obj in objects]
                    }
                )
                return len(objects)
            
            return 0

