import type {
  EmotionPreset,
  ModelCapabilities,
  ModelId,
  SpeedPreset,
  VocalTagDefinition,
  VoiceCategory,
  VoiceDesignPreset,
  VoiceProfile,
} from '../types/studio';

export const VOICE_CATEGORIES: VoiceCategory[] = [
  'All',
  'Deep Male',
  'Cinematic Male',
  'Mature Male',
  'Young Male',
  'Deep Female',
  'Cinematic Female',
  'Documentary Narrator',
  'News Presenter',
  'Friendly Narrator',
  'Calm Storyteller',
  'Horror Narrator',
  'Anime-style Narrator',
];

export const GEMINI_MODELS: Record<ModelId, ModelCapabilities> = {
  'gemini-3.8-flash-tts': {
    id: 'gemini-3.8-flash-tts',
    providerId: 'gemini',
    displayName: 'Gemini 3.8 Flash TTS (Flagship)',
    shortLabel: '3.8 Flash TTS',
    description:
      'Flagship speech synthesis model supporting natural-language Voice Design personas, Telugu te-IN targeting, deterministic voice seed lock, and native vocal bursts (<laugh>, <gasp>, <breath>).',
    maxCharsPerChunk: 2200,
    recommendedChunkChars: 600,
    supportsVoiceDesign: true,
    supportsNativeVocalTags: true,
    supportsLanguageCode: true,
    supportsSeedConsistency: true,
    supportsSpeedGuidance: true,
    supportsEmotionStyle: true,
    supportsPitchSemitones: false,
    supportsStabilitySlider: false,
    supportsSimilaritySlider: false,
    supportedLanguages: [
      'Telugu (te-IN · Unicode)',
      'Roman Telugu (via te-IN + transliteration)',
      'English (en-US)',
      'Hindi & 24+ global languages',
    ],
    rateLimitNote: 'Sequential generation recommended to respect per-minute rate limits.',
  },
  'gemini-3.8-flash-lite-tts': {
    id: 'gemini-3.8-flash-lite-tts',
    providerId: 'gemini',
    displayName: 'Gemini 3.8 Flash Lite TTS',
    shortLabel: '3.8 Flash Lite',
    description:
      'Low-latency, high-throughput model ideal for clean Telugu/English narration and fast drafts. Supports te-IN targeting and seed lock with preset voice identities.',
    maxCharsPerChunk: 2200,
    recommendedChunkChars: 600,
    supportsVoiceDesign: false,
    supportsNativeVocalTags: false,
    supportsLanguageCode: true,
    supportsSeedConsistency: true,
    supportsSpeedGuidance: true,
    supportsEmotionStyle: true,
    supportsPitchSemitones: false,
    supportsStabilitySlider: false,
    supportsSimilaritySlider: false,
    supportedLanguages: [
      'Telugu (te-IN · Unicode)',
      'Roman Telugu (transliteration recommended)',
      'English (en-US)',
      '24+ global languages',
    ],
    rateLimitNote: 'Higher throughput; supports sequential or 2x parallel chunking.',
  },
};

export const GEMINI_VOICES: VoiceProfile[] = [
  {
    id: 'Charon',
    name: 'Charon',
    genderPresentation: 'Male',
    primaryRole: 'Deep & Mysterious Baritone',
    categories: ['Deep Male', 'Mature Male', 'Horror Narrator', 'Documentary Narrator'],
    languages: ['Telugu (te-IN)', 'English', 'Multilingual'],
    description:
      'Deep, grounded baritone timbre with resonant low-end weight. Exceptional for Telugu horror stories, dark suspense, and authoritative narration.',
    compatibleModels: ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'],
    auditionSampleText:
      'రాత్రి రెండు గంటల సమయంలో ఆ పాత బంగ్లా తలుపు మెల్లగా తెరుచుకుంది... లోపలి నుండి ఒక వింత శబ్దం వినిపించింది.',
    auditionStylePrompt:
      'Deep, bass-heavy, slow mysterious Telugu horror narrator with crisp native Telugu pronunciation and chilling pauses.',
  },
  {
    id: 'Algenib',
    name: 'Algenib',
    genderPresentation: 'Male',
    primaryRole: 'Gravelly Dark Thriller Voice',
    categories: ['Deep Male', 'Cinematic Male', 'Horror Narrator', 'Mature Male'],
    languages: ['Telugu (te-IN)', 'English', 'Multilingual'],
    description:
      'Low-pitched, gravelly, textured adult male voice with ominous weight. Ideal for haunted folklore, crime thrillers, and villain monologues.',
    compatibleModels: ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'],
    auditionSampleText:
      'చీకటి పడిన తర్వాత ఆ అడవిలోకి వెళ్లిన వాళ్లెవరూ తిరిగి రాలేదు... ఆ రహస్యం ఇప్పటికీ అక్కడే దాగి ఉంది.',
    auditionStylePrompt:
      'Gravelly, dark, husky deep male voice speaking native Telugu with ominous suspense and measured tension.',
  },
  {
    id: 'Orus',
    name: 'Orus',
    genderPresentation: 'Male',
    primaryRole: 'Firm Cinematic & Documentary Male',
    categories: ['Cinematic Male', 'Mature Male', 'Documentary Narrator', 'News Presenter'],
    languages: ['Telugu (te-IN)', 'English', 'Multilingual'],
    description:
      'Steady, firm, commanding lower-middle register male voice. Delivers authoritative Telugu documentaries, historical sagas, and serious investigative stories.',
    compatibleModels: ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'],
    auditionSampleText:
      'వందల ఏళ్ల నాటి ఆ రాతి శాసనాల వెనుక ఎవరికీ తెలియని ఒక అద్భుతమైన చరిత్ర దాగి ఉంది.',
    auditionStylePrompt:
      'Firm, dignified, cinematic male documentary narrator with clear native Telugu diction and steady gravitas.',
  },
  {
    id: 'Enceladus',
    name: 'Enceladus',
    genderPresentation: 'Male',
    primaryRole: 'Breathy Nocturnal Suspense Male',
    categories: ['Deep Male', 'Horror Narrator', 'Calm Storyteller'],
    languages: ['Telugu (te-IN)', 'English', 'Multilingual'],
    description:
      'Intimate, breathy, close-mic male voice built for eerie late-night storytelling, ghostly whispers, and atmospheric psychological suspense.',
    compatibleModels: ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'],
    auditionSampleText:
      'నీ వెనుక ఎవరో నిలబడి ఉన్నట్టు అనిపిస్తోంది కదూ... కానీ వెనక్కి తిరిగి చూడకు.',
    auditionStylePrompt:
      'Close-mic, slightly breathy, hushed nocturnal male storyteller with natural Telugu intonation and eerie pauses.',
  },
  {
    id: 'Umbriel',
    name: 'Umbriel',
    genderPresentation: 'Male',
    primaryRole: 'Warm Grounded Storyteller',
    categories: ['Deep Male', 'Mature Male', 'Calm Storyteller', 'Friendly Narrator'],
    languages: ['Telugu (te-IN)', 'English', 'Multilingual'],
    description:
      'Warm, smooth, unhurried lower-register male voice suited for long-form Telugu audiobooks, emotional memoirs, and calm narrative explainers.',
    compatibleModels: ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'],
    auditionSampleText:
      'గోదావరి తీరంలోని ఆ చిన్న గ్రామంలో ప్రతి సాయంత్రం ఒక కొత్త కథ మొదలయ్యేది.',
    auditionStylePrompt:
      'Warm, smooth, grounded Telugu storyteller with natural conversational flow and gentle emotional warmth.',
  },
  {
    id: 'Fenrir',
    name: 'Fenrir',
    genderPresentation: 'Male',
    primaryRole: 'Bold Cinematic Trailer Voice',
    categories: ['Cinematic Male', 'Deep Male', 'Horror Narrator', 'Anime-style Narrator'],
    languages: ['Telugu (te-IN)', 'English', 'Multilingual'],
    description:
      'Commanding, intense male voice with sharp dramatic projection. Built for epic movie trailers, high-stakes intros, and powerful shorts.',
    compatibleModels: ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'],
    auditionSampleText:
      'చరిత్రను మలుపు తిప్పే క్షణం వచ్చేసింది. భయాన్ని వదిలి అడుగు ముందుకు వేయండి.',
    auditionStylePrompt:
      'Bold, gritty, cinematic trailer delivery with dramatic gravitas and crisp native Telugu diction.',
  },
  {
    id: 'Puck',
    name: 'Puck',
    genderPresentation: 'Male',
    primaryRole: 'Dynamic YouTube & Reels Presenter',
    categories: ['Young Male', 'Friendly Narrator', 'Anime-style Narrator'],
    languages: ['Telugu (te-IN)', 'English', 'Multilingual'],
    description:
      'Agile, expressive, youthful male voice with energetic cadence. Great for YouTube explainers, tech shorts, commercials, and lively storytelling.',
    compatibleModels: ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'],
    auditionSampleText:
      'హలో ఫ్రెండ్స్! ఈ రోజు మనం ఒక అద్భుతమైన AI టెక్నాలజీ రహస్యం గురించి తెలుసుకోబోతున్నాం.',
    auditionStylePrompt:
      'Energetic, engaging, crisp YouTube creator delivery in natural conversational Telugu.',
  },
  {
    id: 'Kore',
    name: 'Kore',
    genderPresentation: 'Female',
    primaryRole: 'Warm Documentary & News Anchor',
    categories: ['Cinematic Female', 'Documentary Narrator', 'News Presenter', 'Calm Storyteller'],
    languages: ['Telugu (te-IN)', 'English', 'Multilingual'],
    description:
      'Clear, poised female voice balancing warmth and editorial authority. Ideal for documentaries, educational explainers, and news narration.',
    compatibleModels: ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'],
    auditionSampleText:
      'దక్షిణ భారతదేశ చరిత్రలో కాకతీయ సామ్రాజ్యం ఒక స్వర్ణయుగంగా నిలిచిపోయింది.',
    auditionStylePrompt:
      'Articulate, warm, polished documentary narration with refined native Telugu pronunciation.',
  },
  {
    id: 'Zephyr',
    name: 'Zephyr',
    genderPresentation: 'Female',
    primaryRole: 'Deep & Emotional Storyteller',
    categories: ['Deep Female', 'Calm Storyteller', 'Friendly Narrator', 'Cinematic Female'],
    languages: ['Telugu (te-IN)', 'English', 'Multilingual'],
    description:
      'Velvety, intimate female voice capable of gentle calm storytelling as well as haunting suspense and emotional depth.',
    compatibleModels: ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'],
    auditionSampleText:
      'కొన్ని కథలు కేవలం వినడానికి మాత్రమే కాదు... మనసులో ఎప్పటికీ నిలిచిపోవడానికి పుడతాయి.',
    auditionStylePrompt:
      'Warm, velvet-toned emotional storyteller with gentle pauses and natural Telugu cadence.',
  },
];

export const VOICE_DESIGN_PRESETS: VoiceDesignPreset[] = [
  {
    id: 'deep-horror',
    label: 'Deep Horror Narrator',
    recommendedVoice: 'Charon',
    description:
      'An extremely deep, bass-heavy adult male voice. Rich, resonant, slightly husky and mysterious. Speak in natural native Telugu (Andhra/Telangana clarity) with slow cinematic horror pacing, subtle dread, and lingering dramatic pauses.',
    defaultEmotion: 'Fear',
    defaultSpeed: 'Slow',
  },
  {
    id: 'dark-suspense',
    label: 'Dark Suspense Narrator',
    recommendedVoice: 'Algenib',
    description:
      'Low-pitched, gravelly thriller narrator. Controlled tension, hushed ominous intensity, crisp Telugu consonant articulation, and deliberate nocturnal pacing that builds psychological suspense.',
    defaultEmotion: 'Suspense',
    defaultSpeed: 'Slow',
  },
  {
    id: 'mysterious-whisper',
    label: 'Mysterious Whispering Narrator',
    recommendedVoice: 'Enceladus',
    description:
      'Close-mic, airy, eerie whispering male storyteller. Intimate proximity effect, hushed tone, soft controlled breaths, and chilling late-night Telugu horror atmosphere.',
    defaultEmotion: 'Mystery',
    defaultSpeed: 'Very Slow',
  },
  {
    id: 'cinematic-trailer',
    label: 'Cinematic Trailer Voice',
    recommendedVoice: 'Fenrir',
    description:
      'Powerful, chest-resonant epic trailer voice. Punchy gravitas, commanding projection, dramatic pauses before key Telugu reveals, and intense theatrical presence.',
    defaultEmotion: 'Dramatic',
    defaultSpeed: 'Slow',
  },
  {
    id: 'documentary-narrator',
    label: 'Documentary Narrator',
    recommendedVoice: 'Orus',
    description:
      'Authoritative, balanced, broadcast-grade documentary male voice. Crisp native enunciation across Telugu and English terms, measured pacing, and cinematic poise.',
    defaultEmotion: 'Serious',
    defaultSpeed: 'Normal',
  },
  {
    id: 'emotional-storyteller',
    label: 'Emotional Storyteller',
    recommendedVoice: 'Umbriel',
    description:
      'Warm, empathetic, deeply expressive storytelling voice. Gentle breathiness on poignant lines, natural conversational Telugu rhythm, and sincere emotional resonance.',
    defaultEmotion: 'Sadness',
    defaultSpeed: 'Normal',
  },
  {
    id: 'calm-professional',
    label: 'Calm Professional Narrator',
    recommendedVoice: 'Kore',
    description:
      'Clear, composed, trustworthy studio narrator for educational videos and brand explainers. Smooth Telugu-English cadence with zero harshness.',
    defaultEmotion: 'Neutral',
    defaultSpeed: 'Normal',
  },
  {
    id: 'energetic-youtube',
    label: 'Energetic YouTube Presenter',
    recommendedVoice: 'Puck',
    description:
      'Bright, punchy, enthusiastic creator voice tailored for YouTube and Instagram Reels. Fast hook delivery, upbeat inflection, and natural bilingual Telugu-English flow.',
    defaultEmotion: 'Excitement',
    defaultSpeed: 'Fast',
  },
  {
    id: 'deep-villain',
    label: 'Deep Villain Voice',
    recommendedVoice: 'Algenib',
    description:
      'Cold, menacing, gravelly antagonist voice. Slow calculated cadence, dark resonant bass, subtle sardonic edge, and commanding authority.',
    defaultEmotion: 'Anger',
    defaultSpeed: 'Slow',
  },
];

export const EMOTION_PRESETS: EmotionPreset[] = [
  'Neutral',
  'Suspense',
  'Fear',
  'Sadness',
  'Happiness',
  'Anger',
  'Excitement',
  'Mystery',
  'Serious',
  'Dramatic',
];

export const SPEED_PRESETS: { label: SpeedPreset; directive: string; previewRate: number }[] = [
  { label: 'Very Slow', directive: 'Speak very slowly with lingering, suspenseful pauses between phrases', previewRate: 0.78 },
  { label: 'Slow', directive: 'Speak at a slow, deliberate cinematic storytelling pace', previewRate: 0.9 },
  { label: 'Normal', directive: 'Speak at a natural, balanced native conversational pace', previewRate: 1.0 },
  { label: 'Fast', directive: 'Speak at an energetic, brisk pace', previewRate: 1.15 },
  { label: 'Very Fast', directive: 'Speak rapidly with high-energy momentum', previewRate: 1.3 },
];

export const VOCAL_TAGS: VocalTagDefinition[] = [
  {
    tag: '<breath>',
    label: 'Breath',
    description: 'Natural audible inhale before an intense or quiet line.',
    flashTtsSupport: 'native',
    liteTtsSupport: 'unsupported',
    adaptationNote: 'Native vocal burst on 3.8 Flash TTS; removed on Flash Lite TTS.',
  },
  {
    tag: '<gasp>',
    label: 'Gasp',
    description: 'Sudden sharp intake of breath for shock or horror moments.',
    flashTtsSupport: 'native',
    liteTtsSupport: 'unsupported',
    adaptationNote: 'Native vocal burst on 3.8 Flash TTS; removed on Flash Lite TTS.',
  },
  {
    tag: '<laugh>',
    label: 'Laugh',
    description: 'Natural short chuckle or laughter.',
    flashTtsSupport: 'native',
    liteTtsSupport: 'unsupported',
    adaptationNote: 'Native vocal burst on 3.8 Flash TTS; removed on Flash Lite TTS.',
  },
  {
    tag: '|mhm|',
    label: 'Mhm',
    description: 'Subtle conversational backchannel affirmation.',
    flashTtsSupport: 'native',
    liteTtsSupport: 'unsupported',
    adaptationNote: 'Native backchannel cue on 3.8 Flash TTS; removed on Flash Lite TTS.',
  },
  {
    tag: '|yeah|',
    label: 'Yeah',
    description: 'Natural agreement interjection.',
    flashTtsSupport: 'native',
    liteTtsSupport: 'unsupported',
    adaptationNote: 'Native backchannel cue on 3.8 Flash TTS; removed on Flash Lite TTS.',
  },
  {
    tag: '<sigh>',
    label: 'Sigh',
    description: 'Weary or emotional exhale.',
    flashTtsSupport: 'adapted',
    liteTtsSupport: 'adapted',
    adaptationNote: 'Translated to <breath> + weary sighing style instruction (not a raw tag on Gemini).',
  },
  {
    tag: '<whisper>',
    label: 'Whisper',
    description: 'Hushed, close-mic vocal delivery cue.',
    flashTtsSupport: 'adapted',
    liteTtsSupport: 'adapted',
    adaptationNote: 'Converted into a whispered delivery instruction; removed from spoken text.',
  },
  {
    tag: '<pause>',
    label: 'Pause',
    description: 'Dramatic beat of silence between phrases.',
    flashTtsSupport: 'adapted',
    liteTtsSupport: 'adapted',
    adaptationNote: 'Converted into punctuation pause (...) for natural breathing.',
  },
  {
    tag: '<cry>',
    label: 'Cry',
    description: 'Tearful, trembling emotional delivery cue.',
    flashTtsSupport: 'adapted',
    liteTtsSupport: 'adapted',
    adaptationNote: 'Converted into tearful sorrowful style instruction; removed from spoken text.',
  },
  {
    tag: '<shout>',
    label: 'Shout',
    description: 'High-intensity raised voice cue.',
    flashTtsSupport: 'adapted',
    liteTtsSupport: 'adapted',
    adaptationNote: 'Converted into intense projecting style instruction; removed from spoken text.',
  },
];

export const SCRIPT_SAMPLES = [
  {
    id: 'telugu-horror',
    title: 'Midnight Bungalow (Telugu Horror)',
    mode: 'telugu' as const,
    voiceId: 'Charon' as const,
    presetId: 'deep-horror',
    text: `ఆ రాత్రి వర్షం ఆగకుండా కురుస్తోంది. <breath> ఊరి చివర ఉన్న పాత బంగ్లా వైపు రాజు మెల్లగా అడుగులు వేశాడు. <pause>

ఒక్కసారిగా గాలి ఆగిపోయింది. తలుపు వెనుక నుండి ఎవరో గుసగుసలాడుతున్నట్టు వినిపించింది... <gasp> "ఎవరు అక్కడ?" అని రాజు అరిచాడు, కానీ సమాధానం మాత్రం రాలేదు.`,
  },
  {
    id: 'telugu-thriller-algenib',
    title: 'Haunted Forest Mystery (Gravelly Male)',
    mode: 'telugu' as const,
    voiceId: 'Algenib' as const,
    presetId: 'dark-suspense',
    text: `అర్ధరాత్రి దాటిన తర్వాత ఆ కొండదారిలో ఒక్క మనిషి కూడా కనిపించడు. <breath> కానీ ప్రతి అమావాస్య రోజు అక్కడ ఒక దీపం వెలుగుతూనే ఉంటుంది. <pause>

ఆ వెలుగు వెనుక దాగి ఉన్న శాపం ఏమిటో తెలుసుకోవడానికి విక్రమ్ ఆ అడవిలోకి అడుగు పెట్టాడు...`,
  },
  {
    id: 'roman-telugu',
    title: 'Suspense Story (Roman Telugu)',
    mode: 'roman_telugu' as const,
    voiceId: 'Enceladus' as const,
    presetId: 'mysterious-whisper',
    text: `Aa ratri clock lo sarigga 12 ayindi. Intlo lights anni okkasariga off ayyayi. <breath> Kitchen lo nundi edho glass pagilina sound vinipinchindi. <pause> Nenu phone torch on chesi mellaga munduku vellanu... akkada evaru leru, kani table meeda oka paatha diary matram open chesi undi.`,
  },
  {
    id: 'bilingual-doc',
    title: 'AI & Future Cinema (Telugu + English)',
    mode: 'auto' as const,
    voiceId: 'Orus' as const,
    presetId: 'documentary-narrator',
    text: `నేటి డిజిటల్ యుగంలో Storytelling పూర్తిగా మారిపోతోంది. YouTube Creators మరియు Independent Filmmakers కోసం AI Voice Studio ఒక కొత్త విప్లవాన్ని తీసుకొచ్చింది.

సరైన భావోద్వేగం, స్పష్టమైన తెలుగు ఉచ్చారణతో ప్రతి కథకు ప్రాణం పోయడం ఇప్పుడు మరింత సులభమైంది.`,
  },
];

export const FUTURE_ROADMAP_FEATURES = [
  {
    title: 'Voice Cloning with Verified Consent',
    description: 'Custom speaker voiceprints requiring signed voice-owner authorization and cryptographic consent attestation.',
    status: 'Unavailable · Planned Phase 4',
  },
  {
    title: 'Multi-Speaker Screenplay Studio',
    description: '3+ character scene timelines and automated speaker turn assignment beyond dual-speaker synthesis.',
    status: 'Unavailable · Planned Phase 4',
  },
  {
    title: 'Subtitle & SRT / VTT Export',
    description: 'Word-level forced alignment timestamps exported cleanly for Premiere Pro, DaVinci Resolve, and YouTube.',
    status: 'Unavailable · Planned Phase 4',
  },
  {
    title: 'Background Music & SFX Ducking Mixer',
    description: 'Multi-track timeline with ambient horror beds, risers, and automatic voiceover ducking.',
    status: 'Unavailable · Planned Phase 4',
  },
  {
    title: 'Video Voiceover Synchronization',
    description: 'Import MP4 reference cuts and lock narration chunk cues directly to video timecodes.',
    status: 'Unavailable · Planned Phase 4',
  },
];
