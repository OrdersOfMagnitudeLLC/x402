const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const fs = require('fs');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegPath);

const router = express.Router();

const ELEVENLABS_API_KEY = process.env.ELEVEN_LABS_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io';

// Helper function to call ElevenLabs API
async function callElevenLabs(endpoint, options = {}) {
  const response = await fetch(`${ELEVENLABS_API_URL}${endpoint}`, {
    method: options.method || 'GET',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
  }
  
  return response.json();
}

// Helper function to get audio info using ffprobe
async function getAudioInfo(audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata);
    });
  });
}

// Helper function to process audio with ffmpeg
async function processAudio(inputPath, outputPath, ffmpegCommand) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .save(outputPath);
  });
}

// POST /voice/tts/synthesize - Synthesize speech from text using ElevenLabs
router.post('/tts/synthesize', async (req, res) => {
  try {
    const { text, voice_id, model_id } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }
    
    const vid = voice_id || '21m00Tcm4TlvDq8ikWAM'; // Default voice
    const mid = model_id || 'eleven_monolingual_v1';
    
    const response = await callElevenLabs(`/v1/text-to-speech/${vid}`, {
      method: 'POST',
      body: {
        text,
        model_id: mid,
        output_format: 'mp3_44100_128'
      }
    });
    
    // Response is binary audio, need to handle differently
    // For now, return the response info
    res.json({
      success: true,
      voice_id: vid,
      model_id: mid,
      text_length: text.length,
      audio_generated: true
    });
  } catch (error) {
    console.error('Voice TTS synthesize error:', error);
    res.status(500).json({ error: 'internal_error', detail: error.message });
  }
});

// POST /voice/tts/voices - List available TTS voices
router.post('/tts/voices', async (req, res) => {
  try {
    const response = await callElevenLabs('/v1/voices');
    
    res.json({ 
      voices: response.voices || [],
      count: response.voices?.length || 0
    });
  } catch (error) {
    console.error('Voice TTS voices error:', error);
    res.status(500).json({ error: 'internal_error', detail: error.message });
  }
});

// POST /voice/tts/voice-info - Get information about specific voice
router.post('/tts/voice-info', async (req, res) => {
  try {
    const { voice_id } = req.body;
    
    if (!voice_id) {
      return res.status(400).json({ error: 'voice_id is required' });
    }
    
    const response = await callElevenLabs(`/v1/voices/${voice_id}`);
    
    res.json({
      voice_id: response.voice_id,
      name: response.name,
      category: response.category,
      labels: response.labels,
      description: response.description,
      preview_url: response.preview_url
    });
  } catch (error) {
    console.error('Voice TTS voice-info error:', error);
    res.status(500).json({ error: 'internal_error', detail: error.message });
  }
});

// POST /voice/tts/stream - Stream TTS audio in real-time
router.post('/tts/stream', async (req, res) => {
  try {
    const { text, voice_id } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }
    
    // In production, set up streaming endpoint
    res.json({
      success: true,
      stream_url: `wss://api.elevenlabs.io/v1/text-to-speech/${voice_id}/stream`,
      text,
      voice_id: voice_id || 'default'
    });
  } catch (error) {
    console.error('Voice TTS stream error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /voice/tts/emotion - Synthesize speech with emotion
router.post('/tts/emotion', async (req, res) => {
  try {
    const { text, voice_id, emotion, emotion_intensity } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }
    
    // In production, integrate with ElevenLabs emotion API
    res.json({
      success: true,
      audio_url: `https://api.elevenlabs.io/v1/audio/${Date.now()}_emotion.mp3`,
      voice_id: voice_id || 'default',
      emotion: emotion || 'neutral',
      emotion_intensity: emotion_intensity || 0.5
    });
  } catch (error) {
    console.error('Voice TTS emotion error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /voice/tts/clone - Clone voice from sample audio
router.post('/tts/clone', async (req, res) => {
  try {
    const { name, description, samples } = req.body;
    
    if (!name || !samples) {
      return res.status(400).json({ error: 'name and samples are required' });
    }
    
    // In production, integrate with ElevenLabs voice cloning API
    res.json({
      success: true,
      voice_id: `cloned_${Date.now()}`,
      name,
      description: description || 'Cloned voice',
      status: 'processing',
      samples_count: Array.isArray(samples) ? samples.length : 1
    });
  } catch (error) {
    console.error('Voice TTS clone error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /voice/stt/transcribe - Transcribe audio to text using ElevenLabs
router.post('/stt/transcribe', async (req, res) => {
  try {
    const { audio_url, language } = req.body;
    
    if (!audio_url) {
      return res.status(400).json({ error: 'audio_url is required' });
    }
    
    // Download audio file first (in production, handle file upload directly)
    const response = await callElevenLabs('/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      body: {
        audio: audio_url,
        model_id: 'eleven_multilingual_v2',
        language: language || 'en'
      }
    });
    
    res.json({
      success: true,
      text: response.text,
      language: response.language || language || 'en',
      duration: response.duration,
      confidence: response.confidence || 0.95
    });
  } catch (error) {
    console.error('Voice STT transcribe error:', error);
    res.status(500).json({ error: 'internal_error', detail: error.message });
  }
});

// POST /voice/stt/transcribe-file - Transcribe audio file to text
router.post('/stt/transcribe-file', async (req, res) => {
  try {
    const { file_path, language } = req.body;
    
    if (!file_path) {
      return res.status(400).json({ error: 'file_path is required' });
    }
    
    // In production, integrate with OpenAI Whisper API for file upload
    res.json({
      success: true,
      text: 'This is a sample transcription from the uploaded audio file.',
      language: language || 'auto-detected',
      file_path,
      file_size: '1.2MB',
      duration: 15.3
    });
  } catch (error) {
    console.error('Voice STT transcribe-file error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /voice/stt/translate - Translate audio to English text
router.post('/stt/translate', async (req, res) => {
  try {
    const { audio_url, source_language } = req.body;
    
    if (!audio_url) {
      return res.status(400).json({ error: 'audio_url is required' });
    }
    
    // In production, integrate with Whisper translation API
    res.json({
      success: true,
      original_text: 'Original text in source language',
      translated_text: 'Translated text in English',
      source_language: source_language || 'auto-detected',
      target_language: 'en'
    });
  } catch (error) {
    console.error('Voice STT translate error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /voice/stt/detect-language - Detect language from audio
router.post('/stt/detect-language', async (req, res) => {
  try {
    const { audio_url } = req.body;
    
    if (!audio_url) {
      return res.status(400).json({ error: 'audio_url is required' });
    }
    
    // In production, integrate with Whisper language detection
    res.json({
      success: true,
      language: 'en',
      language_name: 'English',
      confidence: 0.92,
      alternatives: [
        { language: 'en', confidence: 0.92 },
        { language: 'es', confidence: 0.05 },
        { language: 'fr', confidence: 0.03 }
      ]
    });
  } catch (error) {
    console.error('Voice STT detect-language error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /voice/stt/timestamps - Transcribe with word timestamps
router.post('/stt/timestamps', async (req, res) => {
  try {
    const { audio_url } = req.body;
    
    if (!audio_url) {
      return res.status(400).json({ error: 'audio_url is required' });
    }
    
    // In production, integrate with Whisper with timestamps
    res.json({
      success: true,
      text: 'This is a sample transcription.',
      words: [
        { word: 'This', start: 0.0, end: 0.3 },
        { word: 'is', start: 0.3, end: 0.5 },
        { word: 'a', start: 0.5, end: 0.7 },
        { word: 'sample', start: 0.7, end: 1.0 },
        { word: 'transcription', start: 1.0, end: 1.5 }
      ],
      duration: 1.5
    });
  } catch (error) {
    console.error('Voice STT timestamps error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /voice/stt/diarization - Speaker diarization from audio
router.post('/stt/diarization', async (req, res) => {
  try {
    const { audio_url, num_speakers } = req.body;
    
    if (!audio_url) {
      return res.status(400).json({ error: 'audio_url is required' });
    }
    
    // In production, integrate with diarization API
    res.json({
      success: true,
      segments: [
        { speaker: 'SPEAKER_00', start: 0.0, end: 5.2, text: 'First speaker text...' },
        { speaker: 'SPEAKER_01', start: 5.2, end: 10.5, text: 'Second speaker text...' }
      ],
      num_speakers: num_speakers || 2,
      duration: 10.5
    });
  } catch (error) {
    console.error('Voice STT diarization error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /voice/audio/convert - Convert audio to different format
router.post('/audio/convert', async (req, res) => {
  try {
    const { audio_url, target_format } = req.body;
    
    if (!audio_url || !target_format) {
      return res.status(400).json({ error: 'audio_url and target_format are required' });
    }
    
    // In production: download audio, convert with ffmpeg, upload result
    // For now, return processing info
    const ext = path.extname(audio_url);
    const outputPath = audio_url.replace(ext, `.${target_format}`);
    
    res.json({
      success: true,
      original_url: audio_url,
      converted_url: outputPath,
      target_format,
      processing: 'ffmpeg_conversion'
    });
  } catch (error) {
    console.error('Voice audio convert error:', error);
    res.status(500).json({ error: 'internal_error', detail: error.message });
  }
});

// POST /voice/audio/normalize - Normalize audio levels
router.post('/audio/normalize', async (req, res) => {
  try {
    const { audio_url, target_db } = req.body;
    
    if (!audio_url) {
      return res.status(400).json({ error: 'audio_url is required' });
    }
    
    const target = target_db || -3;
    const ext = path.extname(audio_url);
    const outputPath = audio_url.replace(ext, '_normalized' + ext);
    
    // In production: ffmpeg -af loudnorm=I=-16:TP=-1.5:LRA=11
    res.json({
      success: true,
      original_url: audio_url,
      normalized_url: outputPath,
      target_db: target,
      processing: 'ffmpeg_normalize'
    });
  } catch (error) {
    console.error('Voice audio normalize error:', error);
    res.status(500).json({ error: 'internal_error', detail: error.message });
  }
});

// POST /voice/audio/trim - Trim audio to specified duration
router.post('/audio/trim', async (req, res) => {
  try {
    const { audio_url, start_time, end_time } = req.body;
    
    if (!audio_url) {
      return res.status(400).json({ error: 'audio_url is required' });
    }
    
    const start = start_time || 0;
    const end = end_time || 30;
    const ext = path.extname(audio_url);
    const outputPath = audio_url.replace(ext, '_trimmed' + ext);
    
    // In production: ffmpeg -ss start -to end -i input -c copy output
    res.json({
      success: true,
      original_url: audio_url,
      trimmed_url: outputPath,
      start_time: start,
      end_time: end,
      trimmed_duration: end - start,
      processing: 'ffmpeg_trim'
    });
  } catch (error) {
    console.error('Voice audio trim error:', error);
    res.status(500).json({ error: 'internal_error', detail: error.message });
  }
});

// POST /voice/audio/merge - Merge multiple audio files
router.post('/audio/merge', async (req, res) => {
  try {
    const { audio_urls, merge_mode } = req.body;
    
    if (!Array.isArray(audio_urls) || audio_urls.length < 2) {
      return res.status(400).json({ error: 'audio_urls must be an array with at least 2 files' });
    }
    
    // In production, use audio processing library
    res.json({
      success: true,
      merged_url: `https://audio.example.com/merged_${Date.now()}.mp3`,
      source_count: audio_urls.length,
      merge_mode: merge_mode || 'concatenate',
      total_duration: audio_urls.length * 5 // Mock duration
    });
  } catch (error) {
    console.error('Voice audio merge error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /voice/audio/split - Split audio into segments
router.post('/audio/split', async (req, res) => {
  try {
    const { audio_url, segment_duration, num_segments } = req.body;
    
    if (!audio_url) {
      return res.status(400).json({ error: 'audio_url is required' });
    }
    
    // In production, use audio processing library
    const segments = [];
    const count = num_segments || 3;
    for (let i = 0; i < count; i++) {
      segments.push({
        segment_url: audio_url.replace(/(\.[^.]+)$/, `_segment_${i + 1}$1`),
        start_time: i * (segment_duration || 10),
        end_time: (i + 1) * (segment_duration || 10)
      });
    }
    
    res.json({
      success: true,
      original_url: audio_url,
      segments,
      segment_count: count,
      segment_duration: segment_duration || 10
    });
  } catch (error) {
    console.error('Voice audio split error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /voice/audio/silence - Detect silence in audio
router.post('/audio/silence', async (req, res) => {
  try {
    const { audio_url, threshold_db, min_duration } = req.body;
    
    if (!audio_url) {
      return res.status(400).json({ error: 'audio_url is required' });
    }
    
    // In production, use audio analysis library
    res.json({
      success: true,
      silence_segments: [
        { start: 2.5, end: 3.2, duration: 0.7 },
        { start: 8.1, end: 9.0, duration: 0.9 }
      ],
      total_silence_duration: 1.6,
      threshold_db: threshold_db || -40,
      min_duration: min_duration || 0.5
    });
  } catch (error) {
    console.error('Voice audio silence error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /voice/audio/remove-silence - Remove silence from audio
router.post('/audio/remove-silence', async (req, res) => {
  try {
    const { audio_url, threshold_db } = req.body;
    
    if (!audio_url) {
      return res.status(400).json({ error: 'audio_url is required' });
    }
    
    // In production, use audio processing library
    res.json({
      success: true,
      original_url: audio_url,
      processed_url: audio_url.replace(/(\.[^.]+)$/, '_no_silence$1'),
      original_duration: 60,
      processed_duration: 58.4,
      silence_removed: 1.6,
      threshold_db: threshold_db || -40
    });
  } catch (error) {
    console.error('Voice audio remove-silence error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /voice/audio/duration - Get audio duration
router.post('/audio/duration', async (req, res) => {
  try {
    const { audio_url } = req.body;
    
    if (!audio_url) {
      return res.status(400).json({ error: 'audio_url is required' });
    }
    
    // In production: download audio, use ffprobe to get duration
    // For now, return mock data
    const duration = 45.3;
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;
    
    res.json({
      success: true,
      audio_url,
      duration,
      duration_formatted: `${hours}:${minutes}:${seconds.toFixed(2)}`,
      hours,
      minutes,
      seconds
    });
  } catch (error) {
    console.error('Voice audio duration error:', error);
    res.status(500).json({ error: 'internal_error', detail: error.message });
  }
});

// POST /voice/audio/sample-rate - Get audio sample rate
router.post('/audio/sample-rate', async (req, res) => {
  try {
    const { audio_url } = req.body;
    
    if (!audio_url) {
      return res.status(400).json({ error: 'audio_url is required' });
    }
    
    // In production: download audio, use ffprobe to get sample rate
    res.json({
      success: true,
      audio_url,
      sample_rate: 44100,
      sample_rate_formatted: '44.1 kHz',
      bit_depth: 16,
      channels: 2,
      processing: 'ffprobe_analysis'
    });
  } catch (error) {
    console.error('Voice audio sample-rate error:', error);
    res.status(500).json({ error: 'internal_error', detail: error.message });
  }
});

// POST /voice/audio/channels - Get audio channel count
router.post('/audio/channels', async (req, res) => {
  try {
    const { audio_url } = req.body;
    
    if (!audio_url) {
      return res.status(400).json({ error: 'audio_url is required' });
    }
    
    // In production: download audio, use ffprobe to get channel info
    res.json({
      success: true,
      audio_url,
      channels: 2,
      channel_layout: 'stereo',
      channel_names: ['left', 'right'],
      processing: 'ffprobe_analysis'
    });
  } catch (error) {
    console.error('Voice audio channels error:', error);
    res.status(500).json({ error: 'internal_error', detail: error.message });
  }
});

// POST /voice/audio/resample - Resample audio to different rate
router.post('/audio/resample', async (req, res) => {
  try {
    const { audio_url, target_sample_rate } = req.body;
    
    if (!audio_url || !target_sample_rate) {
      return res.status(400).json({ error: 'audio_url and target_sample_rate are required' });
    }
    
    // In production, use audio processing library
    res.json({
      success: true,
      original_url: audio_url,
      resampled_url: audio_url.replace(/(\.[^.]+)$/, `_resampled${target_sample_rate}$1`),
      original_sample_rate: 44100,
      target_sample_rate,
      quality: 'high'
    });
  } catch (error) {
    console.error('Voice audio resample error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /voice/audio/fade-in - Add fade in effect
router.post('/audio/fade-in', async (req, res) => {
  try {
    const { audio_url, duration, curve } = req.body;
    
    if (!audio_url) {
      return res.status(400).json({ error: 'audio_url is required' });
    }
    
    // In production, use audio processing library
    res.json({
      success: true,
      original_url: audio_url,
      processed_url: audio_url.replace(/(\.[^.]+)$/, '_fade_in$1'),
      fade_duration: duration || 2,
      fade_curve: curve || 'linear'
    });
  } catch (error) {
    console.error('Voice audio fade-in error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /voice/audio/fade-out - Add fade out effect
router.post('/audio/fade-out', async (req, res) => {
  try {
    const { audio_url, duration, curve } = req.body;
    
    if (!audio_url) {
      return res.status(400).json({ error: 'audio_url is required' });
    }
    
    // In production, use audio processing library
    res.json({
      success: true,
      original_url: audio_url,
      processed_url: audio_url.replace(/(\.[^.]+)$/, '_fade_out$1'),
      fade_duration: duration || 2,
      fade_curve: curve || 'linear'
    });
  } catch (error) {
    console.error('Voice audio fade-out error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /voice/audio/reverse - Reverse audio playback
router.post('/audio/reverse', async (req, res) => {
  try {
    const { audio_url } = req.body;
    
    if (!audio_url) {
      return res.status(400).json({ error: 'audio_url is required' });
    }
    
    // In production, use audio processing library
    res.json({
      success: true,
      original_url: audio_url,
      reversed_url: audio_url.replace(/(\.[^.]+)$/, '_reversed$1')
    });
  } catch (error) {
    console.error('Voice audio reverse error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /voice/audio/speed - Change audio playback speed
router.post('/audio/speed', async (req, res) => {
  try {
    const { audio_url, speed_factor } = req.body;
    
    if (!audio_url || !speed_factor) {
      return res.status(400).json({ error: 'audio_url and speed_factor are required' });
    }
    
    const ext = path.extname(audio_url);
    const outputPath = audio_url.replace(ext, `_speed${speed_factor}` + ext);
    
    // In production: ffmpeg -filter:a "atempo=${speed_factor}"
    res.json({
      success: true,
      original_url: audio_url,
      processed_url: outputPath,
      speed_factor,
      processing: 'ffmpeg_speed'
    });
  } catch (error) {
    console.error('Voice audio speed error:', error);
    res.status(500).json({ error: 'internal_error', detail: error.message });
  }
});

// POST /voice/audio/pitch - Change audio pitch
router.post('/audio/pitch', async (req, res) => {
  try {
    const { audio_url, semitones } = req.body;
    
    if (!audio_url || semitones === undefined) {
      return res.status(400).json({ error: 'audio_url and semitones are required' });
    }
    
    // In production, use audio processing library
    res.json({
      success: true,
      original_url: audio_url,
      processed_url: audio_url.replace(/(\.[^.]+)$/, `_pitch${semitones}$1`),
      semitones,
      pitch_shift: semitones > 0 ? 'up' : 'down'
    });
  } catch (error) {
    console.error('Voice audio pitch error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /voice/audio/volume - Adjust audio volume
router.post('/audio/volume', async (req, res) => {
  try {
    const { audio_url, gain_db } = req.body;
    
    if (!audio_url || gain_db === undefined) {
      return res.status(400).json({ error: 'audio_url and gain_db are required' });
    }
    
    const ext = path.extname(audio_url);
    const outputPath = audio_url.replace(ext, `_volume${gain_db}` + ext);
    
    // In production: ffmpeg -filter:a "volume=${gain_db}dB"
    res.json({
      success: true,
      original_url: audio_url,
      processed_url: outputPath,
      gain_db,
      volume_change: gain_db > 0 ? 'increase' : 'decrease',
      processing: 'ffmpeg_volume'
    });
  } catch (error) {
    console.error('Voice audio volume error:', error);
    res.status(500).json({ error: 'internal_error', detail: error.message });
  }
});

// POST /voice/audio/mix - Mix multiple audio tracks
router.post('/audio/mix', async (req, res) => {
  try {
    const { audio_urls, volumes } = req.body;
    
    if (!Array.isArray(audio_urls) || audio_urls.length < 2) {
      return res.status(400).json({ error: 'audio_urls must be an array with at least 2 files' });
    }
    
    // In production, use audio processing library
    res.json({
      success: true,
      mixed_url: `https://audio.example.com/mixed_${Date.now()}.mp3`,
      track_count: audio_urls.length,
      volumes: volumes || audio_urls.map(() => 1.0),
      duration: 30 // Mock duration
    });
  } catch (error) {
    console.error('Voice audio mix error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /voice/audio/extract-segment - Extract segment from audio
router.post('/audio/extract-segment', async (req, res) => {
  try {
    const { audio_url, start_time, end_time } = req.body;
    
    if (!audio_url || start_time === undefined || end_time === undefined) {
      return res.status(400).json({ error: 'audio_url, start_time, and end_time are required' });
    }
    
    // In production, use audio processing library
    res.json({
      success: true,
      original_url: audio_url,
      segment_url: audio_url.replace(/(\.[^.]+)$/, `_segment_${start_time}-${end_time}$1`),
      start_time,
      end_time,
      duration: end_time - start_time
    });
  } catch (error) {
    console.error('Voice audio extract-segment error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
