// YouTube Transcript - Get actual transcripts from YouTube videos
module.exports.register = (api) => {
  api.registerTool({
    name: 'media.youtubeTranscript',
    inputSchema: {
      type: 'object',
      properties: {
        url: { 
          type: 'string', 
          description: 'YouTube video URL or video ID' 
        }
      },
      required: ['url']
    },
    run: async (input) => {
      try {
        // Extract video ID from URL
        let videoId = input.url;
        const urlMatch = input.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\/]+)/);
        if (urlMatch) {
          videoId = urlMatch[1];
        }
        
        // Use youtube-transcript package
        const { YoutubeTranscript } = await import('youtube-transcript');
        
        const transcript = await YoutubeTranscript.fetchTranscript(videoId);
        
        // Combine all text segments
        const fullText = transcript.map(item => item.text).join(' ');
        
        // Also format with timestamps for reference
        const timestampedText = transcript.map(item => {
          const minutes = Math.floor(item.offset / 60000);
          const seconds = Math.floor((item.offset % 60000) / 1000);
          return `[${minutes}:${seconds.toString().padStart(2, '0')}] ${item.text}`;
        }).join('\n');
        
        return {
          content: `Transcript for https://youtube.com/watch?v=${videoId}\n\n${fullText}`,
          metadata: {
            videoId,
            videoUrl: `https://youtube.com/watch?v=${videoId}`,
            segments: transcript.length,
            timestampedTranscript: timestampedText,
            duration: transcript[transcript.length - 1]?.offset || 0
          }
        };
        
      } catch (error) {
        return {
          content: `Failed to fetch transcript: ${error.message}\n\nPossible reasons:\n- Video has no captions/subtitles\n- Video is private or age-restricted\n- Captions are disabled by uploader`,
          error: error.message,
          metadata: { url: input.url }
        };
      }
    }
  });
};
