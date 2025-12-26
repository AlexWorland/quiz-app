"""Audio chunk combination service using ffmpeg."""
import subprocess
import tempfile
from pathlib import Path


class AudioCombiner:
    """Combines WebM audio chunks into a single file using ffmpeg directly."""
    
    def combine_chunks(self, chunk_files: list[bytes]) -> bytes:
        """Combine multiple audio chunks into a single file.
        
        Args:
            chunk_files: List of audio chunk bytes in order
            
        Returns:
            Combined audio file bytes
            
        Raises:
            ValueError: If no chunks provided or combination fails
        """
        if not chunk_files:
            raise ValueError("No chunks to combine")
        
        # Create temp directory for processing
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)
            
            # Write chunks to temp files
            chunk_paths = []
            for i, chunk_data in enumerate(chunk_files):
                chunk_path = tmpdir_path / f"chunk_{i:04d}.webm"
                chunk_path.write_bytes(chunk_data)
                chunk_paths.append(chunk_path)
            
            # Create concat list file for ffmpeg
            concat_file = tmpdir_path / "concat_list.txt"
            with open(concat_file, 'w') as f:
                for chunk_path in chunk_paths:
                    f.write(f"file '{chunk_path}'\n")
            
            # Use ffmpeg to concatenate
            output_path = tmpdir_path / "combined.webm"
            
            try:
                subprocess.run([
                    'ffmpeg',
                    '-f', 'concat',
                    '-safe', '0',
                    '-i', str(concat_file),
                    '-c', 'copy',  # Copy codec, don't re-encode (faster)
                    str(output_path)
                ], check=True, capture_output=True, text=True)
            except subprocess.CalledProcessError as e:
                raise ValueError(f"ffmpeg combination failed: {e.stderr}")
            
            if not output_path.exists():
                raise ValueError("Failed to create combined audio file")
            
            return output_path.read_bytes()

