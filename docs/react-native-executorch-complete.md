# React Native ExecuTorch — Complete Documentation (LLM-Ready / MCP Reference)

> **Version:** 0.9.x
> **Source:** https://docs.swmansion.com/react-native-executorch/
> **GitHub:** https://github.com/software-mansion/react-native-executorch
> **Generated:** June 20, 2026

React Native ExecuTorch brings Meta's ExecuTorch AI framework into the React Native ecosystem, enabling developers to run AI models and LLMs locally, directly on mobile devices. It provides a declarative API for on-device inference, allowing you to use local AI models without relying on cloud infrastructure. Built on the ExecuTorch foundation — part of the PyTorch Edge ecosystem — it extends efficient on-device AI deployment to cross-platform mobile applications in React Native.

---

## Table of Contents

1. [Fundamentals](#1-fundamentals)
   - [Getting Started](#11-getting-started)
   - [Loading Models](#12-loading-models)
   - [Glossary of Terms](#13-glossary-of-terms)
   - [FAQ](#14-faq)
   - [Compatibility](#15-compatibility)
2. [Hooks — Natural Language Processing](#2-hooks--natural-language-processing)
   - [useLLM](#21-usellm)
   - [useTextEmbeddings](#22-usetextembeddings)
   - [useSpeechToText](#23-usespeechtotext)
   - [useTextToSpeech](#24-usetexttospeech)
   - [useVAD](#25-usevad)
   - [useTokenizer](#26-usetokenizer)
   - [usePrivacyFilter](#27-useprivacyfilter)
3. [Hooks — Computer Vision](#3-hooks--computer-vision)
   - [useClassification](#31-useclassification)
   - [useObjectDetection](#32-useobjectdetection)
   - [useOCR](#33-useocr)
   - [useVerticalOCR](#34-useverticalocr)
   - [useSemanticSegmentation](#35-usesemanticsegmentation)
   - [useInstanceSegmentation](#36-useinstancesegmentation)
   - [useImageEmbeddings](#37-useimageembeddings)
   - [useStyleTransfer](#38-usestyletransfer)
   - [usePoseEstimation](#39-useposeestimation)
   - [useTextToImage](#310-usetexttoimage)
   - [VisionCamera Integration](#311-visioncamera-integration)
4. [Hooks — ExecuTorch Bindings](#4-hooks--executorch-bindings)
   - [useExecutorchModule](#41-useexecutorchmodule)
5. [TypeScript Module API](#5-typescript-module-api)
   - [LLMModule](#51-llmmodule)
   - [TextEmbeddingsModule](#52-textembeddingsmodule)
   - [SpeechToTextModule](#53-speechtotextmodule)
   - [TextToSpeechModule](#54-texttospeechmodule)
   - [VADModule](#55-vadmodule)
   - [TokenizerModule](#56-tokenizermodule)
   - [PrivacyFilterModule](#57-privacyfiltermodule)
   - [ClassificationModule](#58-classificationmodule)
   - [ObjectDetectionModule](#59-objectdetectionmodule)
   - [OCRModule](#510-ocrmodule)
   - [VerticalOCRModule](#511-verticalocrmodule)
   - [SemanticSegmentationModule](#512-semanticsegmentationmodule)
   - [InstanceSegmentationModule](#513-instancesegmentationmodule)
   - [ImageEmbeddingsModule](#514-imageembeddingsmodule)
   - [StyleTransferModule](#515-styletransfermodule)
   - [TextToImageModule](#516-texttoimagemodule)
   - [ExecutorchModule](#517-executorchmodule)
6. [Model Registry](#6-model-registry)
7. [Resource Fetcher](#7-resource-fetcher)
8. [Error Handling](#8-error-handling)
9. [Benchmarks](#9-benchmarks)

---

## 1. Fundamentals

### 1.1 Getting Started

**ExecuTorch** is a novel AI framework developed by Meta, designed to streamline deploying PyTorch models on a variety of devices, including mobile phones and microcontrollers. This framework enables exporting models into standalone binaries, allowing them to run locally without requiring API calls. ExecuTorch achieves state-of-the-art performance through optimizations and delegates such as Core ML and XNNPACK.

**React Native ExecuTorch** is the bridge bringing ExecuTorch into the React Native world. The API is built to be simple, declarative, and efficient. Pre-exported models are provided for common use cases. With just a few lines of JavaScript, you can run AI models (including LLMs) right on your device — keeping user data private and saving on cloud costs.

**Compatibility:** React Native Executorch supports **only the New React Native architecture**. For supported React Native and Expo versions, see the Compatibility table.

#### Installation

**Step 1 — Install the core package:**

```bash
npm install react-native-executorch
# or
pnpm add react-native-executorch
# or
yarn add react-native-executorch
```

**Step 2 — Install a resource fetcher (pick one):**

**Expo projects (recommended):**
```bash
npm install react-native-executorch-expo-resource-fetcher expo-file-system expo-asset
```

**Bare React Native projects:**
```bash
npm install react-native-executorch-bare-resource-fetcher @dr.pogodin/react-native-fs @kesha-antonov/react-native-background-downloader
```

**Step 3 — Initialize at app entry point:**

```typescript
import { initExecutorch } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';
// or BareResourceFetcher for bare react-native projects

initExecutorch({ resourceFetcher: ExpoResourceFetcher });
```

> **WARNING:** Calling any library API without initializing first will throw a `ResourceFetcherAdapterNotInitialized` error.

**Metro config (if using require()):**
```javascript
// metro.config.js
defaultConfig.resolver.assetExts.push('pte');
defaultConfig.resolver.assetExts.push('bin');
```

**Building from source:**
```bash
git clone -b release/0.9 https://github.com/software-mansion/react-native-executorch.git
cd react-native-executorch
git submodule update --init --recursive packages/react-native-executorch/third-party/common
yarn
```

**Adding new models follows a 3-step pipeline:**
1. **Model Serialization:** Export PyTorch model into `*.pte` format for ExecuTorch runtime
2. **Native Implementation:** C++ execution layer interfacing with ExecuTorch runtime (inference, pre/post-processing)
3. **TS Bindings:** TypeScript API bridging JavaScript to native C++ logic

### 1.2 Loading Models

Three methods for loading model files, depending on size and location:

**1. Load from React Native assets folder (< 512MB):**
```typescript
useExecutorchModule({
  modelSource: require('../assets/lfm2_5.pte'),
});
```

**2. Load from remote URL (for files > 512MB or to keep app size small):**
```typescript
useExecutorchModule({
  modelSource: 'https://.../lfm2_5.pte',
});
```

**3. Load from local file system:**
```typescript
useExecutorchModule({
  modelSource: 'file:///var/mobile/.../lfm2_5.pte',
});
```

**Predefined Models:**
```typescript
import { models, useLLM } from 'react-native-executorch';
const llm = useLLM({ model: models.llm.lfm2_5_1_2b_instruct() });
```

### 1.3 Glossary of Terms

| Term | Definition |
|------|-----------|
| **Backend** | Execution engine for running model computations on specific hardware. **XNNPACK**: optimized CPU backend (default). **Core ML**: Apple's framework using CPU/GPU/ANE. |
| **Forward Function** | Primary method of a PyTorch module that defines computation at every call. What gets exported and compiled for ExecuTorch. |
| **Inference** | Process of using a trained ML model to make predictions or generate outputs for given input data. |
| **Out-of-the-Box Support** | Features/models that work immediately without custom compilation or complex configuration. |
| **Prefill** | Initial LLM phase where the model processes the entire input prompt at once. Performance metric: "Time to First Token" (TTFT). |
| **Quantization** | Technique to reduce model size and speed up inference by using lower-precision data types (e.g., FP32 → INT8). Benefits: lower memory, better battery. Trade-off: slight accuracy reduction. |
| **Tensor** | Fundamental data structure — multi-dimensional array holding inputs, weights, and outputs. |
| **Token** | Basic unit of text an LLM reads/generates. ~1,000 tokens ≈ 750 English words. Models have a "Context Window" limit. |
| **Tokenization** | Process of converting raw text into numerical IDs (tokens) that the model can understand. |

### 1.4 FAQ

**What models are supported?** Each hook documentation page lists supported models. For custom models, use `useExecutorchModule` or `ExecutorchModule`.

**How can I run my own AI model?** Use `useExecutorchModule`/`ExecutorchModule` to access the underlying ExecuTorch Module API. Export your model to `.pte` format using ExecuTorch tutorials.

**How does it work under the hood?**
1. TypeScript calls C++ function via JSI
2. C++ performs model inference/data processing
3. C++ returns result to TypeScript via JSI
4. Zero-copy data transfer using JSI

**Function calling with useLLM?** Yes, if the model supports tool calling. Otherwise, work around using context.

**Bare React Native support?** Yes, from version 0.8.x+ using the bare resource fetcher.

**Old Architecture support?** No, not supported and not planned.

**GGUF models?** No, ExecuTorch doesn't support GGUF models.

**GPU acceleration?** Limited. Core ML on iOS uses CPU/GPU/ANE. Android GPU (Vulkan) has limited operator support. Most models use XNNPACK (CPU).

**XNNPACK and Core ML?** Yes, all backends are linked. Export with the desired backend.

### 1.5 Compatibility

**react-native-executorch:**
| Version | RN 0.81+ | RN 0.82+ | RN 0.83+ | RN 0.84+ | RN 0.85+ |
|---------|----------|----------|----------|----------|----------|
| 0.8.x   | yes      | yes      | yes      | yes      | yes      |
| 0.9.x   | yes      | yes      | yes      | yes      | yes      |

**Expo Resource Fetcher:**
| Version | Expo SDK 54 | Expo SDK 55 |
|---------|-------------|-------------|
| 0.8.x   | yes         | yes         |
| 0.9.x   | yes         | yes         |

---

## 2. Hooks — Natural Language Processing

### 2.1 useLLM

Run Large Language Models on-device. Supports Llama 3.2, Qwen3, SmolLM2, Phi-4, Hammer, LFM2.5, and more.

```typescript
import { models, useLLM } from 'react-native-executorch';

const llm = useLLM({ model: models.llm.lfm2_5_1_2b_instruct() });
```

**Arguments (LLMProps):**
- `model` — model source, tokenizer source, tokenizer config source (or use `models.llm.*()`)
- `preventLoad` — optional flag to prevent auto-loading

**Returns (LLMType):**
- **State:** `response`, `token`, `isReady`, `isGenerating`, `downloadProgress`, `error`, `messageHistory`
- **Generation:** `generate`, `sendMessage`, `interrupt`
- **Configuration:** `configure`, `deleteMessage`
- **Token counting:** `getGeneratedTokenCount`, `getPromptTokenCount`, `getTotalTokenCount`

#### Functional vs Managed

**Functional/pure** — no state management. You handle conversation history and function calling. Use `generate` and `response`. `chatConfig` and `toolsConfig` have no effect.

```typescript
const chat: Message[] = [
  { role: 'system', content: 'You are a helpful assistant' },
  { role: 'user', content: 'What is the meaning of life?' },
];
const response = await llm.generate(chat);
```

**Managed/stateful** — library manages conversation state. Tool calls parsed and called automatically. Use `sendMessage` and `configure`.

```typescript
llm.sendMessage('Hi, who are you?');
// Access conversation history
llm.messageHistory.map((message) => <Text>{message.content}</Text>);
```

#### Tool Calling

```typescript
const TOOL_DEFINITIONS: LLMTool[] = [
  {
    name: 'get_weather',
    description: 'Get/check weather in given location.',
    parameters: {
      type: 'dict',
      properties: {
        location: { type: 'string', description: 'Location' },
      },
      required: ['location'],
    },
  },
];

llm.configure({
  toolsConfig: {
    tools: TOOL_DEFINITIONS,
    executeToolCallback: async (call) => {
      if (call.toolName === 'get_weather') return 'Weather is great!';
      return null;
    },
    displayToolCalls: true,
  },
});
```

#### Configuration

```typescript
llm.configure({
  chatConfig: {
    systemPrompt: 'You are a helpful assistant.',
    initialMessageHistory: [{ role: 'user', content: 'Hello' }],
    contextStrategy: new MessageCountContextStrategy(6),
  },
  generationConfig: {
    outputTokenBatchSize: 15,
    batchTimeInterval: 100,
    temperature: 0.7,
    topP: 0.9,
    minP: 0.05,
    repetitionPenalty: 1.05,
  },
});
```

**Context Strategies:**
- `NoopContextStrategy` — no context management
- `MessageCountContextStrategy(n)` — keep last n messages
- `SlidingWindowContextStrategy` — default, manages context window

#### Structured Output

```typescript
import { Schema } from 'jsonschema';

const responseSchema: Schema = {
  properties: {
    username: { type: 'string' },
    bid: { type: 'number' },
  },
  required: ['username', 'bid'],
  type: 'object',
};

// Or use Zod
import * as z from 'zod/v4';
const schema = z.object({
  username: z.string().meta({ description: 'User name' }),
  bid: z.number().meta({ description: 'Bid amount' }),
});
```

#### Interrupting

```typescript
llm.interrupt(); // Stop generation
// Check: llm.isGenerating === false before unmounting component
```

#### Vision-Language Models (VLM)

```typescript
const llm = await LLMModule.fromModelName(
  models.llm.gemma4_e2b_multimodal()
);
const response = await llm.sendMessage('What is in this image?', {
  imagePath: '/path/to/image.jpg',
});
```

### 2.2 useTextEmbeddings

Convert text into numerical representations for semantic search, classification, and clustering.

```typescript
import { models, useTextEmbeddings } from 'react-native-executorch';

const model = useTextEmbeddings({
  model: models.text_embedding.all_minilm_l6_v2(),
});

const embedding = await model.forward('Hello World!');
```

**Arguments (TextEmbeddingsProps):**
- `model` — model source and tokenizer source
- `preventLoad` — optional flag

**Returns (TextEmbeddingsType):**
- `forward(text)` — returns `Promise<number[]>` (embedding vector)
- `isReady`, `isGenerating`, `error`, `downloadProgress`

**Supported Models:**

| Model | Language | Max Tokens | Dims | Description |
|-------|----------|------------|------|-------------|
| all-MiniLM-L6-v2 | English | 254 | 384 | All-round model, 1B+ training pairs |
| all-mpnet-base-v2 | English | 382 | 768 | All-round model, 1B+ training pairs |
| multi-qa-MiniLM-L6-cos-v1 | English | 509 | 384 | Tuned for semantic search |
| multi-qa-mpnet-base-dot-v1 | English | 510 | 768 | Tuned for semantic search |
| distiluse-base-multilingual-cased-v2 | 50+ languages | 126 | 512 | Multilingual DistilBERT |
| paraphrase-multilingual-MiniLM-L12-v2 | 50+ languages | 126 | 384 | Multilingual sentence encoder |
| clip-vit-base-patch32-text | English | 74 | 512 | CLIP text encoder |

> Vectors are normalized (length = 1). Cosine similarity = dot product.

### 2.3 useSpeechToText

Convert spoken audio into written text using Whisper models. Supports file transcription and live streaming.

```typescript
import { models, useSpeechToText } from 'react-native-executorch';

const model = useSpeechToText({
  model: models.speech_to_text.whisper_tiny_en(),
});
```

**Basic Usage (File Transcription):**
```typescript
const result = await model.transcribe(audioBuffer);
console.log('Transcription:', result.text);

// With options
const result = await model.transcribe(audioBuffer, {
  language: 'es',      // for multilingual models
  verbose: true,       // word-level timestamps
});
```

**Live Streaming Transcription:**
```typescript
// Feed audio chunks
model.streamInsert(audioChunk);

// Process stream
const streamIter = model.stream({ useVAD: true });
for await (const { committed, nonCommitted } of streamIter) {
  // committed = finalized text
  // nonCommitted = temporary text that may update
}

// Stop
model.streamStop();
```

**Streaming Options:**
- `language` — language code for multilingual models
- `verbose` — word-level timestamps
- `useVAD` — enable Voice Activity Detection submodule
- `timeout` — interval between processing chunks (default: 100ms)
- `vadDetectionMargin` — silence duration before committing (default: 500ms)

**Returns:**
- `transcribe(audio, options)` — `Promise<TranscriptionResult>`
- `stream(options)` — async generator yielding `{ committed, nonCommitted }`
- `streamInsert(audio)` — insert audio chunk
- `streamStop()` — stop streaming
- `encode(audio)` — run encoder only
- `decode(tokens, encoderOutput)` — run decoder only

**Supported Models:** whisper-tiny.en, whisper-tiny, whisper-base.en, whisper-base, whisper-small.en, whisper-small

### 2.4 useTextToSpeech

Generate natural-sounding speech from text using Kokoro models.

```typescript
import { models, useTextToSpeech } from 'react-native-executorch';
import { AudioContext } from 'react-native-audio-api';

const tts = useTextToSpeech(models.text_to_speech.kokoro.en_us.heart());

const waveform = await tts.forward({ text: 'Hello world!', speed: 1.0 });

// Play audio
const audioContext = new AudioContext({ sampleRate: 24000 });
const audioBuffer = audioContext.createBuffer(1, waveform.length, 24000);
audioBuffer.getChannelData(0).set(waveform);
const source = audioContext.createBufferSource();
source.buffer = audioBuffer;
source.connect(audioContext.destination);
source.start();
```

**Methods:**
- `forward({ text, speed, phonemize })` — complete waveform at once
- `stream({ text, speed, phonemize, onNext, ... })` — streaming chunks (recommended for long text)
- `streamInsert(text)` — insert text during streaming
- `streamStop(instant)` — stop streaming

**Phoneme Mode:** Set `phonemize: false` to use pre-computed IPA phonemes.

**Supported:** Kokoro (English, French, German, Spanish, Portuguese, Italian, Polish, Hindi)

### 2.5 useVAD

Voice Activity Detection — identify speech segments in audio with timestamps.

```typescript
import { useVAD, models } from 'react-native-executorch';

const model = useVAD({ model: models.vad.fsmn_vad() });

// Static processing
const speechSegments = await model.forward(audioBuffer);

// Live streaming
model.stream({
  onSpeechBegin: () => console.log('Speech started'),
  onSpeechEnd: () => console.log('Speech ended'),
  options: { timeout: 100, detectionMargin: 500 },
});
model.streamInsert(audioChunk);
model.streamStop();
```

**Supported:** fsmn-vad

### 2.6 useTokenizer

Tokenize text into numerical IDs and back.

```typescript
import { models, useTokenizer } from 'react-native-executorch';

const tokenizer = useTokenizer({
  tokenizer: models.text_embedding.all_minilm_l6_v2(),
});

const tokens = await tokenizer.encode('Hello, world!');
const decoded = await tokenizer.decode(tokens);
const vocabSize = await tokenizer.getVocabSize();
const tokenId = await tokenizer.tokenToId('hello');
const token = await tokenizer.idToToken(tokenId);
```

### 2.7 usePrivacyFilter

Detect personally identifiable information (PII) in text on-device.

```typescript
import { models, usePrivacyFilter } from 'react-native-executorch';

const model = usePrivacyFilter({ model: models.privacy_filter.openai() });

const entities = await model.generate(
  'My name is Sarah Chen and my email is [email protected].'
);
// [
//   { label: 'private_person', text: 'Sarah Chen', startToken: 3, endToken: 5 },
//   { label: 'private_email', text: '[email protected]', startToken: 11, endToken: 14 },
// ]
```

**Supported Models:**
- `openai/privacy-filter` — 8 categories (names, emails, phones, addresses, etc.)
- `OpenMed/privacy-filter-nemotron` — 55+ categories (medical, financial, etc.)

---

## 3. Hooks — Computer Vision

### 3.1 useClassification

Assign a label to an image that best describes its contents.

```typescript
import { models, useClassification } from 'react-native-executorch';

const model = useClassification({
  model: models.classification.efficientnet_v2_s(),
});

const classes = await model.forward('file:///path/to/image.png');
// { "tabby": 0.45, "tiger_cat": 0.30, "Egyptian_cat": 0.15, ... }
```

**Input:** remote URL, local file URI, base64-encoded image, or PixelData object.

**Supported:** efficientnet_v2_s (1000 classes, ImageNet, quantized ✅)

### 3.2 useObjectDetection

Identify and locate objects within images with bounding boxes, labels, and confidence scores.

```typescript
import { models, useObjectDetection } from 'react-native-executorch';

const model = useObjectDetection({
  model: models.object_detection.yolo26n(),
});

const detections = await model.forward(imageUri, {
  detectionThreshold: 0.5,
  inputSize: 640,
  classesOfInterest: ['PERSON', 'CAR'],
});
// [{ bbox: { x1, y1, x2, y2 }, label: 'PERSON', score: 0.92 }, ...]
```

**Supported Models:**

| Model | Classes | Multi-size |
|-------|---------|------------|
| SSDLite320 MobileNetV3 Large | 91 (COCO) | No (320×320) |
| RF-DETR Nano | 80 (COCO) | No (384×384) |
| YOLO26N/S/M/L/X | 80 (COCO YOLO) | Yes (384/512/640) |

### 3.3 useOCR

Detect and recognize text within images.

```typescript
import { models, useOCR } from 'react-native-executorch';

const model = useOCR({ model: models.ocr.craft({ language: 'en' }) });

const detections = await model.forward('https://url-to-image.jpg');
// [{ bbox: { x1, y1, x2, y2 }, text: 'Hello World', score: 0.95 }, ...]
```

**Alphabet-Specific Recognizers:**
- `RECOGNIZER_LATIN_CRNN` — Latin alphabet (Polish, German, etc.)
- `RECOGNIZER_CYRILLIC_CRNN` — Cyrillic alphabet (Russian, Ukrainian, etc.)

**Supported:** CRAFT (detector) + CRNN (recognizer)

### 3.4 useVerticalOCR

Vertical text recognition (experimental). Same API as useOCR with `independentCharacters` option.

```typescript
const model = useVerticalOCR({
  model: models.ocr.craft({ language: 'en' }),
  independentCharacters: true,
});
```

### 3.5 useSemanticSegmentation

Per-pixel classification of images.

```typescript
import { models, useSemanticSegmentation } from 'react-native-executorch';

const model = useSemanticSegmentation({
  model: models.semantic_segmentation.deeplab_v3_resnet50(),
});

const result = await model.forward(imageUri, ['CAT', 'PERSON'], true);
// result.ARGMAX — Int32Array of per-pixel class indices
// result.CAT — Float32Array of per-pixel probabilities
```

**Options:** `classesOfInterest` (which masks to return), `resizeToInput` (resize to original dimensions).

**Supported:** deeplab-v3-resnet50/101, deeplab-v3-mobilenet-v3-large, lraspp-mobilenet-v3-large, fcn-resnet50/101, selfie-segmentation

### 3.6 useInstanceSegmentation

Detect individual objects with per-pixel segmentation masks.

```typescript
import { models, useInstanceSegmentation } from 'react-native-executorch';

const model = useInstanceSegmentation({
  model: models.instance_segmentation.yolo26n(),
});

const instances = await model.forward(imageUri, {
  confidenceThreshold: 0.5,
  inputSize: 640,
});
// [{ bbox, label, score, mask, maskWidth, maskHeight }, ...]
```

**Promptable Selection:**
```typescript
import { selectByPoint, selectByBox, selectByText } from 'react-native-executorch';

const pointMatch = selectByPoint(instances, x, y);
const boxMatch = selectByBox(instances, { x1, y1, x2, y2 });
const textMatch = selectByText(instances, instanceEmbeddings, textEmbedding);
```

**Supported:** yolo26n/s/m/l/x-seg, rfdetr-nano-seg, fastsam-s, fastsam-x

### 3.7 useImageEmbeddings

Generate feature vectors for images (similarity search, clustering).

```typescript
import { models, useImageEmbeddings } from 'react-native-executorch';

const model = useImageEmbeddings({
  model: models.image_embedding.clip_vit_base_patch32_image(),
});

const embedding = await model.forward('https://url-to-image.jpg');
// Float32Array (512 dimensions, normalized)
```

**Supported:** clip-vit-base-patch32-image (224×224 → 512 dims)

### 3.8 useStyleTransfer

Apply artistic styles to images in real-time.

```typescript
import { models, useStyleTransfer } from 'react-native-executorch';

const model = useStyleTransfer({ model: models.style_transfer.candy() });

const uri = await model.forward(imageUri, 'url');     // Returns file URI
const pixels = await model.forward(imageUri);          // Returns PixelData
```

**Supported:** Candy, Mosaic, Udnie, Rain Princess

### 3.9 usePoseEstimation

Detect human bodies and locate keypoints (nose, shoulders, knees, etc.).

```typescript
import { models, usePoseEstimation } from 'react-native-executorch';

const model = usePoseEstimation({
  model: models.pose_estimation.yolo26n(),
});

const detections = await model.forward(imageUri, {
  detectionThreshold: 0.5,
  inputSize: 640,
});
// [{ NOSE: { x, y }, LEFT_SHOULDER: { x, y }, ... }, ...]
```

**Supported:** YOLO26N-Pose (17 COCO keypoints, multi-size), RF-DETR Keypoint (preview)

### 3.10 useTextToImage

Generate images from text descriptions using Stable Diffusion pipeline.

```typescript
import { models, useTextToImage } from 'react-native-executorch';

const model = useTextToImage({
  model: models.image_generation.bk_sdm_tiny_vpred_256(),
});

const image = await model.generate('a medieval castle', 256, 25);
// Returns file:// URI to PNG
```

**Arguments:** `generate(prompt, imageSize, numSteps, seed?)`
- Image size must be multiple of 32 (128–512)
- Seed enables reproducibility

**Supported:** bk-sdm-tiny-vpred (0.5B params)

### 3.11 VisionCamera Integration

Real-time frame processing via VisionCamera v5 using `runOnFrame` worklet.

**Prerequisites:** `react-native-vision-camera` v5 + `react-native-worklets`

**Supported hooks:** useClassification, useImageEmbeddings, useOCR, useVerticalOCR, useObjectDetection, useInstanceSegmentation, useSemanticSegmentation, useStyleTransfer, usePoseEstimation

```typescript
import { Camera, useFrameOutput } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';

const frameOutput = useFrameOutput({
  pixelFormat: 'rgb',           // REQUIRED — must be 'rgb'
  dropFramesWhileBusy: true,
  onFrame: useCallback((frame: Frame) => {
    'worklet';
    try {
      const result = model.runOnFrame(frame, isFrontCamera, threshold);
      if (result) scheduleOnRN(setResults, result);
    } finally {
      frame.dispose();          // REQUIRED — always dispose
    }
  }, []),
});

<Camera
  device={device}
  outputs={[frameOutput]}
  isActive
  orientationSource="device"   // REQUIRED for correct orientation
/>
```

**Key Requirements:**
- `pixelFormat: 'rgb'` (default yuv produces incorrect results)
- `orientationSource="device"` on Camera
- `frame.dispose()` in finally block
- `enablePhysicalBufferRotation` must remain false (default)

---

## 4. Hooks — ExecuTorch Bindings

### 4.1 useExecutorchModule

Direct React Native bindings to the ExecuTorch Module API for custom models.

```typescript
import { useExecutorchModule, ScalarType } from 'react-native-executorch';

const executorchModule = useExecutorchModule({
  modelSource: require('../assets/models/model.pte'),
});

const inputTensor = {
  dataPtr: new Float32Array(1 * 3 * 640 * 640),
  sizes: [1, 3, 640, 640],
  scalarType: ScalarType.FLOAT,
};

const output = await executorchModule.forward([inputTensor]);
// output[0].dataPtr — ArrayBuffer of results
```

**TensorPtr fields:**
- `dataPtr` — ArrayBuffer or TypedArray
- `sizes` — tensor shape (e.g., `[1, 3, 640, 640]`)
- `scalarType` — ExecuTorch ScalarType enum (FLOAT, INT, etc.)

---

## 5. TypeScript Module API

All hooks have equivalent class-based TypeScript APIs for non-React contexts.

### 5.1 LLMModule

```typescript
import { models, LLMModule } from 'react-native-executorch';

const llm = await LLMModule.fromModelName(
  models.llm.lfm2_5_1_2b_instruct(),
  (progress) => console.log(progress),
  (token) => console.log(token),
  (messages) => console.log(messages)
);

const response = await llm.sendMessage('Hello, World!');
llm.interrupt();
llm.delete();

// Custom model
const llm2 = await LLMModule.fromCustomModel(
  'https://example.com/model.pte',
  'https://example.com/tokenizer.json',
  'https://example.com/tokenizer_config.json'
);

// Vision-Language Model
const vlm = await LLMModule.fromModelName(
  models.llm.gemma4_e2b_multimodal()
);
const response = await vlm.sendMessage('Describe this image.', {
  imagePath: '/path/to/image.jpg',
});
```

### 5.2 TextEmbeddingsModule

```typescript
const module = await TextEmbeddingsModule.fromModelName(
  models.text_embedding.all_minilm_l6_v2()
);
const embedding = await module.forward('Hello World!');
```

### 5.3 SpeechToTextModule

```typescript
const model = await SpeechToTextModule.fromModelName(
  models.speech_to_text.whisper_tiny_en(),
  models.vad.fsmn_vad()  // optional VAD
);

const result = await model.transcribe(waveform);
model.streamInsert(audioChunk);
for await (const { committed, nonCommitted } of model.stream({ useVAD: true })) { ... }
model.streamStop();
```

### 5.4 TextToSpeechModule

```typescript
const tts = await TextToSpeechModule.fromModelName(
  models.text_to_speech.kokoro.en_us.heart()
);

// One-shot
const waveform = await tts.forward('Hello!', 1.0);

// Streaming
for await (const chunk of tts.stream({ text: 'Hello!', speed: 1.0 })) { ... }

// From phonemes
const waveform = await tts.forward('həlˈO wˈɜɹld!', 1.0, false);
```

### 5.5 VADModule

```typescript
const model = await VADModule.fromModelName(models.vad.fsmn_vad());
const segments = await model.forward(waveform);

// Streaming
model.stream({ onSpeechBegin: () => {}, onSpeechEnd: () => {} });
model.streamInsert(chunk);
model.streamStop();
```

### 5.6 TokenizerModule

```typescript
const tokenizer = new TokenizerModule();
await tokenizer.load(models.text_embedding.all_minilm_l6_v2());

const tokens = await tokenizer.encode('Hello');
const decoded = await tokenizer.decode(tokens);
const vocabSize = await tokenizer.getVocabSize();
```

### 5.7 PrivacyFilterModule

```typescript
const model = await PrivacyFilterModule.fromModelName(
  models.privacy_filter.openai()
);
const entities = await model.generate('My name is Sarah Chen.');
```

### 5.8 ClassificationModule

```typescript
const module = await ClassificationModule.fromModelName(
  models.classification.efficientnet_v2_s()
);
const classes = await module.forward(imageUri);

// Custom model
const classifier = await ClassificationModule.fromCustomModel(
  'https://example.com/custom.pte',
  { labelMap: { CAT: 0, DOG: 1 } }
);
```

### 5.9 ObjectDetectionModule

```typescript
const module = await ObjectDetectionModule.fromModelName(
  models.object_detection.yolo26n()
);
const detections = await module.forward(imageUri, { inputSize: 640 });
```

### 5.10 OCRModule

```typescript
const module = await OCRModule.fromModelName(
  models.ocr.craft({ language: 'en' })
);
const detections = await module.forward(imageUri);
```

### 5.11 VerticalOCRModule

```typescript
const module = await VerticalOCRModule.fromModelName(
  models.ocr.craft({ language: 'en' })
);
```

### 5.12 SemanticSegmentationModule

```typescript
const module = await SemanticSegmentationModule.fromModelName(
  models.semantic_segmentation.deeplab_v3_resnet50()
);
const result = await module.forward(imageUri, ['CAT']);

// Custom model
const seg = await SemanticSegmentationModule.fromCustomModel(
  'https://example.com/model.pte',
  { labelMap: { BG: 0, FG: 1 }, preprocessorConfig: { normMean: [0.485, 0.456, 0.406], normStd: [0.229, 0.224, 0.225] } }
);
```

### 5.13 InstanceSegmentationModule

```typescript
const module = await InstanceSegmentationModule.fromModelName(
  models.instance_segmentation.yolo26n()
);
const instances = await module.forward(imageUri, { confidenceThreshold: 0.5 });
```

### 5.14 ImageEmbeddingsModule

```typescript
const module = await ImageEmbeddingsModule.fromModelName(
  models.image_embedding.clip_vit_base_patch32_image()
);
const embedding = await module.forward(imageUri);
```

### 5.15 StyleTransferModule

```typescript
const module = await StyleTransferModule.fromModelName(
  models.style_transfer.candy()
);
const uri = await module.forward(imageUri, 'url');
```

### 5.16 TextToImageModule

```typescript
const module = await TextToImageModule.fromModelName(
  models.image_generation.bk_sdm_tiny_vpred_256()
);
const image = await module.forward('a castle', 256, 25);
```

### 5.17 ExecutorchModule

Class-based API for custom ExecuTorch models:

```typescript
import { ExecutorchModule, ScalarType } from 'react-native-executorch';

const model = new ExecutorchModule();
await model.load(models.style_transfer.candy());

const inputTensor = {
  dataPtr: new Float32Array(1 * 3 * 640 * 640),
  sizes: [1, 3, 640, 640],
  scalarType: ScalarType.FLOAT,
};

const output = await model.forward([inputTensor]);
model.delete();
```

---

## 6. Model Registry

The Model Registry is a typed, grouped index of every model shipped with React Native ExecuTorch.

```typescript
import { models } from 'react-native-executorch';

// Default (quantized when available, platform-default backend)
const llm = useLLM({ model: models.llm.llama3_2_3b() });

// Non-quantized variant
const llmBase = useLLM({ model: models.llm.llama3_2_3b({ quant: false }) });

// Explicit backend
const detector = useObjectDetection({
  model: models.object_detection.rf_detr_nano({ backend: 'xnnpack' }),
});
```

**Registry Groups:**

| Group | Examples |
|-------|----------|
| `llm` | llama3_2_3b, qwen3_4b, smollm2_1_1_7b, phi_4_mini_4b, lfm2_5_1_2b_instruct, lfm2_5_vl_1_6b, … |
| `classification` | efficientnet_v2_s |
| `privacy_filter` | openai, nemotron |
| `object_detection` | ssdlite_320_mobilenet_v3_large, yolo26n…yolo26x, rf_detr_nano |
| `pose_estimation` | yolo26n |
| `semantic_segmentation` | deeplab_v3_resnet50, lraspp_mobilenet_v3_large, fcn_resnet101, … |
| `instance_segmentation` | yolo26n…yolo26x, rfdetr-nano-seg, fastsam-s, fastsam-x |
| `style_transfer` | candy, mosaic, rain_princess, udnie |
| `speech_to_text` | whisper_tiny_en, whisper_base, whisper_small_en, … |
| `text_to_speech` | kokoro.en_us.{heart, river, sarah, adam, …}, kokoro.fr.siwis, … |
| `text_embedding` | all_minilm_l6_v2, all_mpnet_base_v2, clip_vit_base_patch32_text, … |
| `image_embedding` | clip_vit_base_patch32_image |
| `image_generation` | bk_sdm_tiny_vpred_256, bk_sdm_tiny_vpred_512 |
| `vad` | fsmn_vad |
| `ocr` | craft({ language: 'en' }) — nested by detector |

**Options:** `{ quant?: boolean, backend?: 'xnnpack' | 'coreml' | 'mlx' }`

**Direct imports still work:**
```typescript
import { LFM2_5_1_2B_INSTRUCT, models } from 'react-native-executorch';
useLLM({ model: LFM2_5_1_2B_INSTRUCT });
```

---

## 7. Resource Fetcher

### 7.1 Usage (ExpoResourceFetcher / BareResourceFetcher)

```typescript
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';

// Fetch resources
const uris = await ExpoResourceFetcher.fetch(
  (progress) => console.log(progress),
  'https://.../model.pte',
  'https://.../tokenizer.json'
);

// Pause/Resume
await ExpoResourceFetcher.pauseFetching('https://.../model.pte');
const uris = await ExpoResourceFetcher.resumeFetching('https://.../model.pte');

// Cancel
await ExpoResourceFetcher.cancelFetching('https://.../model.pte');

// Delete
await ExpoResourceFetcher.deleteResources('https://.../model.pte');

// Utilities
const totalSize = await ExpoResourceFetcher.getFilesTotalSize('https://.../model.pte');
const files = await ExpoResourceFetcher.listDownloadedFiles();
const models = await ExpoResourceFetcher.listDownloadedModels();
```

### 7.2 Custom Adapter

Implement the `ResourceFetcherAdapter` interface:

```typescript
import { ResourceFetcherAdapter, ResourceSource } from 'react-native-executorch';

const MyCustomFetcher: ResourceFetcherAdapter = {
  fetch: async (callback, ...sources) => {
    // callback(progress) — called with 0..1
    // sources can be: string (URL/path), number (asset), object (JSON config)
    // Return array of local file paths, or null if interrupted
    return ['/local/path/model.pte'];
  },
  readAsString: async (path) => {
    // Read file as UTF-8 string
    return 'file contents';
  },
};

initExecutorch({ resourceFetcher: MyCustomFetcher });
```

---

## 8. Error Handling

All errors inherit from `RnExecutorchError` with a `code` property.

```typescript
import { RnExecutorchError, RnExecutorchErrorCode } from 'react-native-executorch';

try {
  await llm.sendMessage('Hello');
} catch (err) {
  if (err instanceof RnExecutorchError) {
    switch (err.code) {
      case RnExecutorchErrorCode.ModuleNotLoaded:
        // Load model first
        break;
      case RnExecutorchErrorCode.ModelGenerating:
        // Wait or interrupt
        break;
      case RnExecutorchErrorCode.InvalidConfig:
        // Fix configuration
        break;
      default:
        console.error(err.message);
    }
  }
}
```

**Error Categories:**

**Module State:** `ModuleNotLoaded`, `ModelGenerating`

**Configuration:** `InvalidConfig`, `InvalidUserInput`, `InvalidModelSource`, `LanguageNotSupported`, `PlatformNotSupported`, `WrongDimensions`, `UnexpectedNumInputs`

**File Operations:** `FileReadFailed`, `FileWriteFailed`

**Download/Resource:** `DownloadInterrupted`, `ResourceFetcherDownloadFailed`, `ResourceFetcherDownloadInProgress`, `ResourceFetcherAdapterNotInitialized`, ...

**STT Streaming:** `MultilingualConfiguration`, `MissingDataChunk`, `StreamingNotStarted`, `StreamingInProgress`

**Model Execution:** `InvalidModelOutput`, `ThreadPoolError`, `TokenizerError`, `UnknownError`

**ExecuTorch Runtime:** `Internal`, `InvalidState`, `AlreadyLoaded`, `NotSupported`, `OperatorMissing`, `MemoryAllocationFailed`, `OutOfResources`, ...

---

## 9. Benchmarks

### Inference Time

**Classification:**
| Model | iPhone 17 Pro | Pixel 10 |
|-------|--------------|----------|
| EFFICIENTNET_V2_S (XNNPACK FP32) | 70ms | 100ms |
| EFFICIENTNET_V2_S (XNNPACK INT8) | 22ms | 38ms |
| EFFICIENTNET_V2_S (Core ML FP16) | 5ms | - |

**Object Detection (YOLO @ 512px):**
| Model | iPhone 17 Pro | Pixel 10 |
|-------|--------------|----------|
| YOLO26N | 29ms | 38ms |
| YOLO26S | 60ms | 72ms |
| YOLO26M | 134ms | 177ms |
| YOLO26L | 169ms | 216ms |
| YOLO26X | 371ms | 434ms |

**LLMs (tokens/s):**
| Model | Pixel 10 | iPhone 17 Pro | OnePlus 12 |
|-------|----------|---------------|------------|
| LLAMA3_2_1B_SPINQUANT | 24 | 36 | 48 |
| LLAMA3_2_3B_SPINQUANT | 11 | 12 | 18 |
| QWEN3_4B_QUANTIZED | 5 | 7 | 10 |
| LFM2_5_1_2B_INSTRUCT_QUANTIZED | 8 | 26 | 47 |
| SMOLLM2_1_135M_QUANTIZED | 20 | 32 | 64 |

**Speech to Text (Whisper-tiny):**
| Metric | iPhone 17 Pro | iPhone SE 3 | OnePlus 12 |
|--------|--------------|-------------|------------|
| Encoding (30s) | 89ms | 403ms | 260ms |
| Decoding (per token) | 6ms | 40ms | 25ms |

**Text to Speech (Kokoro ~60 tokens):**
| Model | iPhone 17 Pro | OnePlus 12 |
|-------|--------------|------------|
| Kokoro-small | 2051ms | 1548ms |
| Kokoro-medium | 2124ms | 1625ms |

### Memory Usage (Peak during inference)

| Category | iPhone 17 Pro | Device 2 |
|----------|--------------|----------|
| LLM LLAMA3_2_1B_SPINQUANT | 2.4 GB | 1.9 GB |
| LLM LLAMA3_2_3B_SPINQUANT | 3.8 GB | 3.7 GB |
| Whisper-tiny | 375 MB | 410 MB |
| Kokoro-small | 820 MB | 820 MB |
| YOLO26N | 36 MB | 44 MB |
| EfficientNet V2 S (INT8) | 62 MB | 78 MB |
| CLIP Image Embeddings | 340 MB | 345 MB |

### Model Size

| Model | XNNPACK | Core ML FP16 |
|-------|---------|-------------|
| LLAMA3_2_1B | 2.47 GB | - |
| LLAMA3_2_1B_SPINQUANT | 1.14 GB | - |
| LLAMA3_2_3B | 6.43 GB | - |
| QWEN3_4B_QUANTIZED | 2.50 GB | - |
| EfficientNet V2 S (INT8) | 22.9 MB | 43.9 MB |
| YOLO26N | 10.3 MB | - |
| Whisper-tiny | 151 MB | - |
| Kokoro-small | 329.6 MB | - |
| all-MiniLM-L6-v2 | 91 MB | - |
| FSMN-VAD | 1.83 MB | - |

---

## 10. Core Concepts

### 10.1 Architecture

React Native ExecuTorch is a bridge that brings Meta's ExecuTorch runtime to React Native applications. It enables on-device AI inference by providing a JavaScript/TypeScript API layer on top of ExecuTorch's native C++ runtime.

**What is ExecuTorch?**
- Lightweight runtime optimized for mobile and embedded devices
- Edge-optimized models: Compiled `.pte` (PyTorch ExecuTorch) model files
- Efficient execution: Minimal memory footprint and fast inference
- Hardware acceleration: Support for device-specific backends (CPU, GPU, NPU)

**Architecture Layers:**

1. **JavaScript/TypeScript Layer** — Developer-friendly API with Modules, Hooks, and full TypeScript support
2. **JSI Bridge Layer** — Zero-copy data transfer, synchronous calls, worklet support, global functions
3. **Native C++ Layer** — Model loading, input preprocessing, inference execution, output postprocessing, memory management
4. **ExecuTorch Runtime** — Model execution engine, operator implementations, backend delegates, memory allocators

**Module System:** All modules extend from `BaseModule` which provides core functionality (load, forward, delete).

**Specialized Modules:**
- `VisionModule<TOutput>` — Unified API for string paths or pixel data, worklet-compatible frame processor
- `LLMModule` — Uses controller pattern for conversation management

**Data Flow:** TypeScript → JSI → C++ (ExecuTorch runtime) → C++ → JSI → TypeScript

**Platform Support:** iOS (CocoaPods), Android (Gradle), Expo (development builds with config plugins), Bare React Native (direct native module linking)

**Performance Characteristics:**
- Model Loading: One-time operation, cached in app document directory
- Inference: Synchronous execution, typically 10-500ms depending on model size
- Memory: Models loaded into native heap, call `module.delete()` to release

### 10.2 Model Loading

Model loading is the process of downloading resources, preparing native modules, and loading ExecuTorch `.pte` model files into memory.

**Loading Lifecycle:**
```typescript
const module = new ExecutorchModule();
await module.load(modelSource, (progress) => console.log(progress));
const output = await module.forward(inputTensors);
module.delete();
```

**Module-Specific Loading:**
- `ExecutorchModule` — Just a model binary
- `VisionModule` — Model file only
- `LLMModule` — Model + tokenizer + tokenizer config
- `OCRModule` — Detector + recognizer + symbols
- `TextToImageModule` — Tokenizer + encoder + unet + decoder + scheduler config

**Download Progress Tracking:** Progress from 0 to 1, weighted by file size for multi-file downloads.

**Caching Behavior:**
- Downloaded files cached in `{DocumentDirectory}/react-native-executorch/`
- Subsequent loads use cached file (fast ~2s vs initial 30s for 1GB model)
- No automatic cache invalidation — delete to force re-download

**Error Handling:** Handle `RnExecutorchErrorCode` codes: `ResourceFetcherAdapterNotInitialized`, `ResourceFetcherDownloadFailed`, `DownloadInterrupted`, `InvalidProgram`, `MemoryAllocationFailed`

**Preloading Strategies:** App startup, background download, lazy loading on-demand

### 10.3 Resource Fetching

React Native ExecuTorch uses a `ResourceFetcher` abstraction for downloading and caching model files.

**ResourceFetcherAdapter Interface:**
```typescript
interface ResourceFetcherAdapter {
  fetch(callback: (progress: number) => void, ...sources: ResourceSource[]): Promise<string[] | null>;
  readAsString(path: string): Promise<string>;
}
```

**ResourceSource Types:**
- String: Remote URLs, local file paths, file URIs
- Number: Bundled assets via `require('./assets/model.pte')`
- Object: Configuration objects (saved as JSON)

**Caching Strategy:** URLs converted to safe filenames, cached in document directory, no automatic invalidation.

### 10.4 Error Handling (Detailed)

**RnExecutorchError Class:** All errors inherit from this with a `code` property.

**Application-Level Errors (100-199):**
| Code | Name | Description |
|------|------|-------------|
| 101 | UnknownError | Unexpected failures |
| 102 | ModuleNotLoaded | Model not downloaded/loaded |
| 103 | FileWriteFailed | Failed to save output files |
| 104 | ModelGenerating | Concurrent inference attempts |
| 105 | LanguageNotSupported | Unsupported language |
| 112 | InvalidConfig | Invalid configuration parameters |
| 113 | ThreadPoolError | Threading issue |
| 114 | FileReadFailed | Failed to read input file |
| 115 | InvalidModelOutput | Unexpected output size |
| 116 | WrongDimensions | Input tensor shape mismatch |
| 117 | InvalidUserInput | Invalid input data |
| 118 | DownloadInterrupted | Download cancelled/paused |
| 119 | PlatformNotSupported | Feature not supported on platform |
| 160 | MultilingualConfiguration | STT multilingual config mismatch |
| 161 | MissingDataChunk | Streaming without audio data |
| 162 | StreamingNotStarted | Stop/insert on non-started stream |
| 163 | StreamingInProgress | Start while another stream active |
| 167 | TokenizerError | Tokenization failed |
| 255 | InvalidModelSource | Wrong type for model source |

**Resource Fetcher Errors (180-186):**
| Code | Name | Description |
|------|------|-------------|
| 180 | ResourceFetcherDownloadFailed | Download failed |
| 181 | ResourceFetcherDownloadInProgress | Already downloading |
| 182 | ResourceFetcherAlreadyPaused | Already paused |
| 183 | ResourceFetcherAlreadyOngoing | Already ongoing |
| 184 | ResourceFetcherNotActive | Inactive download |
| 185 | ResourceFetcherMissingUri | URI missing |
| 186 | ResourceFetcherAdapterNotInitialized | Fetcher not initialized |

**ExecuTorch Runtime Errors (0-99):**
| Code | Name | Description |
|------|------|-------------|
| 0 | Ok | Success |
| 1 | Internal | Internal error |
| 2 | InvalidState | Invalid executor state |
| 16 | NotSupported | Operation not supported |
| 20 | OperatorMissing | Missing operator |
| 33 | MemoryAllocationFailed | Out of memory |
| 35 | InvalidProgram | Invalid .pte file |
| 48-50 | Delegate* | Backend delegation errors |

---

## 11. Guides

### 11.1 Quickstart

Build a chat app in minutes:

```typescript
// 1. Initialize
import { initExecutorch } from 'react-native-executorch';
import { ExpoResourceFetcher } from '@react-native-executorch/expo-resource-fetcher';
initExecutorch({ resourceFetcher: ExpoResourceFetcher });

// 2. Create Chat Component
import { useLLM, LLAMA3_2_1B } from 'react-native-executorch';
const llm = useLLM({ model: LLAMA3_2_1B });
await llm.sendMessage('Hello!');
console.log(llm.response);
```

**Key State Properties:**
| Property | Type | Description |
|----------|------|-------------|
| isReady | boolean | Model loaded and ready |
| isGenerating | boolean | Generating response |
| downloadProgress | number | 0 to 1 |
| messageHistory | Message[] | All conversation messages |
| response | string | Current response being generated |
| error | RnExecutorchError \| null | Error if failed |

**Key Methods:** sendMessage, generate, interrupt, deleteMessage, configure, getGeneratedTokenCount, getPromptTokenCount, getTotalTokenCount

**Performance Tips:**
- Start with `LLAMA3_2_1B_SPINQUANT` for best performance
- Only load one model at a time
- Use `temperature: 0` for deterministic outputs
- Implement context strategies for conversation length

### 11.2 Installation (Detailed)

**Prerequisites:**
- New Architecture Required
- iOS 17.0+, Android 13 (API 33)+, React Native 0.81+

**Platform-Specific Setup:**

**Expo:**
```bash
npx expo run:ios   # or run:android
```

**Bare React Native:**
```bash
cd ios && pod install && cd ..
npx react-native run-ios   # or run-android
```

**Common Issues:**
- New Architecture Not Enabled → Enable in Podfile/gradle.properties
- Android Minimum SDK → Set `minSdkVersion = 33`
- iOS Deployment Target → Set `platform :ios, '17.0'`
- Module Not Found → Clear cache, reinstall, clean rebuild

### 11.3 Expo Setup Guide

**Prerequisites:** Node.js 18+, Expo CLI, iOS 17.0+ or Android 13+, 4GB+ RAM

**Steps:**
1. Create/update Expo project
2. Install dependencies: `react-native-executorch`, `@react-native-executorch/expo-resource-fetcher`, `expo-file-system`, `expo-asset`
3. Initialize resource fetcher in `_layout.tsx`
4. Configure New Architecture in `app.json`
5. Run: `npx expo run:ios` or `npx expo run:android`

**Expo Resource Fetcher Features:**
- Fetch, pause, resume, cancel downloads
- List downloaded files and models
- Get total size, delete unused models
- Works with Expo assets for small models (< 512MB)

**Configuration:**
- Increase Android heap: `org.gradle.jvmargs=-Xmx4096m`
- Configure microphone permissions for STT
- Files stored in `{DocumentDirectory}/react-native-executorch/`

### 11.4 Bare React Native Setup

**Steps:**
1. Create/update React Native project (0.81+)
2. Install: `react-native-executorch`, `@react-native-executorch/bare-resource-fetcher`, `@dr.pogodin/react-native-fs`, `@kesha-antonov/react-native-background-downloader`
3. Link native dependencies: `cd ios && pod install`
4. Enable New Architecture
5. Initialize: `initExecutorch({ resourceFetcher: BareResourceFetcher })`
6. Run: `npx react-native run-ios` or `run-android`

**Background Downloads:** Continue even when app is backgrounded via `react-native-background-downloader`.

**Platform Configuration:**
- iOS: Add UIBackgroundModes (fetch, processing) to Info.plist
- Android: Add permissions (INTERNET, storage), set `android:largeHeap="true"`

### 11.5 Migrating Models to ExecuTorch

**Migration Workflow:**
1. Prepare PyTorch model (eval mode, frozen parameters)
2. Create example inputs matching expected format
3. Export to ATEN dialect: `aten_dialect = export(model, example_inputs)`
4. Convert to Edge dialect: `edge_program = to_edge(aten_dialect)`
5. Generate `.pte` file: `executorch_program = edge_program.to_executorch()`
6. Save: `with open("model.pte", "wb") as f: f.write(executorch_program.buffer)`

**Using optimum-executorch:**
```python
from optimum.executorch import ExecuTorchModelForImageClassification
model = ExecuTorchModelForImageClassification.from_pretrained("google/mobilenet_v2_1.0_224", export=True)
model.save_pretrained("./exported_model")
```

**Optimizations:**
- **Quantization:** Reduce size with XNNPACK quantizer (per-channel recommended)
- **Backend Delegation:** XNNPACK (cross-platform), Core ML (iOS only)
- **Combined:** Quantization + XNNPACK for best performance

**Dynamic Shapes:**
```python
from torch.export import Dim
batch = Dim("batch", min=1, max=32)
seq_len = Dim("seq_len", min=1, max=512)
```

**Testing:** Validate with Python before React Native:
```python
from executorch.extension.pybindings.portable_lib import _load_for_executorch
module = _load_for_executorch("model.pte")
output = module.forward((test_input,))
```

**Best Practices:** Test before migrating, use representative inputs, validate outputs, start simple, quantize for production, check operator support, document process, version control models.

---

## 12. Advanced Topics

### 12.1 Debugging

**Error Handling Patterns:** Use `RnExecutorchError` with typed error codes.

**Monitoring Hook State:**
```typescript
useEffect(() => { console.log('isReady:', llm.isReady); }, [llm.isReady]);
useEffect(() => { console.log('isGenerating:', llm.isGenerating); }, [llm.isGenerating]);
useEffect(() => { console.log('Download:', llm.downloadProgress); }, [llm.downloadProgress]);
useEffect(() => { if (llm.error) console.error('Error:', llm.error); }, [llm.error]);
```

**Track Token Generation:**
```typescript
const startTime = Date.now();
await llm.generate(messages);
const tokensPerSecond = llm.getGeneratedTokenCount() / ((Date.now() - startTime) / 1000);
```

**Common Issues:**
1. **Model Not Loading** → Check initExecutorch(), downloadProgress, error state
2. **Out of Memory** → Use quantized models (LLAMA3_2_1B_SPINQUANT)
3. **Generation Hangs** → Implement timeout, call interrupt()
4. **Invalid Input** → Validate file paths, formats before processing
5. **Tokenizer Errors** → Ensure all three sources provided (model, tokenizer, config)
6. **Download Failures** → Implement retry logic with exponential backoff

**Debugging Checklist:**
- Is resource fetcher initialized?
- Is model downloaded? (check downloadProgress)
- Is model loaded? (check isReady)
- Are there errors? (check error state)
- Are inputs valid?
- Is device memory sufficient?
- Have you tested on a physical device?

### 12.2 Performance Optimization

**Model Quantization:**
- XNNPACK quantization (recommended): per-channel, static quantization
- SpinQuant for LLMs: ~42% memory reduction (LLAMA3_2_1B: 3.3GB → 1.9GB)
- QLoRA: ~20-25% reduction

**Backend Delegation:**
- XNNPACK: Cross-platform, highly optimized for ARM CPUs
- Core ML: iOS only, can leverage GPU and Neural Engine

**Runtime Optimization:**
```typescript
llm.configure({
  generationConfig: {
    temperature: 0.7,
    topP: 0.9,
    outputTokenBatchSize: 10,
    batchTimeInterval: 100,
  },
});
```

**Application-Level:**
- Preload models during startup
- Cache models locally
- Batch process images sequentially
- Interrupt long operations with `llm.interrupt()`

**Monitoring:** Track tokens/sec, download progress, use React Native DevTools

### 12.3 Memory Management

**Memory Requirements:**
| Model | iPhone 17 Pro | OnePlus 12 |
|-------|--------------|------------|
| LLAMA3_2_1B | 3.1 GB | 3.3 GB |
| LLAMA3_2_1B_SPINQUANT | 2.4 GB | 1.9 GB |
| LLAMA3_2_3B | 7.3 GB | 7.1 GB |
| LLAMA3_2_3B_SPINQUANT | 3.8 GB | 3.7 GB |

**Strategies:**
1. **Choose Quantized Models** — SpinQuant (~40-45% reduction), QLoRA (~20-25%)
2. **Unload When Not Needed** — Call `llm.delete()` to free memory
3. **Load on Demand** — Use `preventLoad: true`, load only when needed
4. **Manage Context Window** — Use `SlidingWindowContextStrategy` or `MessageCountContextStrategy`
5. **Configure Generation** — Limit `maxTokens` and `sequenceLength`
6. **Clean Up Downloads** — Delete unused cached models

**Component Lifecycle:** Hooks auto-cleanup on unmount. TypeScript API requires manual `delete()`.

**Memory Warnings:**
```typescript
// iOS
AppState.addEventListener('memoryWarning', () => { llm.delete(); });
// Android
DeviceEventEmitter.addListener('onTrimMemory', (event) => { if (event.level >= 40) llm.delete(); });
```

**Device Recommendations:**
- iPhone 15 Pro+: 3B models (LLAMA3_2_3B_SPINQUANT)
- iPhone 12-14: 1B models (LLAMA3_2_1B_SPINQUANT)
- Android 8GB+: 3B models
- Android 6GB: 1B quantized models
- Android 4GB: Computer vision only

### 12.4 Custom Models

**Exporting to .pte:**
```python
import torch
from executorch.exir import to_edge
from torch.export import export

model = YourModel()
model.eval()
example_inputs = (torch.randn(1, 3, 224, 224),)
aten_dialect = export(model, example_inputs)
edge_program = to_edge(aten_dialect)
executorch_program = edge_program.to_executorch()
with open("model.pte", "wb") as f:
    f.write(executorch_program.buffer)
```

**Loading Custom Models:**
```typescript
const module = useExecutorchModule({ modelSource: 'https://your-server.com/model.pte' });
const output = await module.forward([inputTensor]);
```

**Using optimum-executorch:**
```python
from optimum.executorch import ExecuTorchModelForImageClassification
model = ExecuTorchModelForImageClassification.from_pretrained("google/mobilenet_v2_1.0_224", export=True)
model.save_pretrained("./exported_model")
```

**Best Practices:** Start simple, test incrementally, check operator support, optimize for mobile, version control.

### 12.5 Troubleshooting Guide

**Installation Issues:**
- `ResourceFetcherAdapterNotInitialized` → Call `initExecutorch()` before using hooks
- Native Module Not Found → Clean rebuild (`rm -rf Pods`, `pod install`)
- New Architecture Not Enabled → Enable in Podfile/gradle.properties, rebuild

**Model Loading Issues:**
- `isReady` stays false → Check download progress, error state, network
- Download fails → Implement retry with exponential backoff
- Invalid model file → Delete and re-download, verify `.pte` format

**Memory Issues:**
- Out of Memory → Use quantized models, increase emulator RAM, enable largeHeap
- Memory warnings → Handle platform-specific events, unload models

**Generation Issues:**
- Hangs → Implement timeout, call `interrupt()`
- Empty responses → Validate inputs, check configuration
- `ModelGenerating` error → Check `isGenerating` before calling

**Input/Output Issues:**
- `FileReadFailed` → Validate file paths, check permissions
- `WrongDimensions` → Match input tensor shape to model requirements
- `TokenizerError` → Ensure all three sources provided

**Platform-Specific:**
- iOS Simulator → Test on real devices for accurate performance
- Android Emulator → Increase RAM to 4GB+, enable hardware acceleration
- iOS Build Errors → Clean Pods, DerivedData, reinstall
- Android Build Errors → Clean Gradle, reset Metro cache

---

## 13. LLM Deep Dive

### 13.1 LLM Overview

**Key Features:**
- On-device inference with no server dependency
- Token streaming for real-time generation feedback
- Built-in conversation management with context strategies
- Tool calling for external function integration
- Download progress monitoring
- Multiple model families (Llama, Qwen, Hammer, SmolLM, Phi)
- Quantization support for reduced memory footprint

**Core Concepts:**
- Model Loading: Auto-download and load on hook init
- Message History: `messageHistory` array tracking conversation
- Token Streaming: `token` (latest), `response` (accumulated), `isGenerating`
- Error Handling: `error` state with `RnExecutorchError`

### 13.2 Available Models

**Llama 3.2:** LLAMA3_2_1B (2GB), LLAMA3_2_1B_QLORA (500MB), LLAMA3_2_1B_SPINQUANT (600MB), LLAMA3_2_3B (6GB), LLAMA3_2_3B_QLORA (1.5GB), LLAMA3_2_3B_SPINQUANT (1.8GB)

**Qwen 3:** QWEN3_0_6B (1.2GB), QWEN3_0_6B_QUANTIZED (400MB), QWEN3_1_7B (3.4GB), QWEN3_1_7B_QUANTIZED (900MB), QWEN3_4B (8GB), QWEN3_4B_QUANTIZED (2GB)

**Qwen 2.5:** QWEN2_5_0_5B (1GB), QWEN2_5_0_5B_QUANTIZED (300MB), QWEN2_5_1_5B (3GB), QWEN2_5_1_5B_QUANTIZED (800MB), QWEN2_5_3B (6GB), QWEN2_5_3B_QUANTIZED (1.5GB)

**Hammer 2.1:** HAMMER2_1_0_5B (1GB), HAMMER2_1_0_5B_QUANTIZED (300MB), HAMMER2_1_1_5B (3GB), HAMMER2_1_1_5B_QUANTIZED (800MB), HAMMER2_1_3B (6GB), HAMMER2_1_3B_QUANTIZED (1.5GB)

**SmolLM 2:** SMOLLM2_1_135M (270MB), SMOLLM2_1_135M_QUANTIZED (80MB), SMOLLM2_1_360M (720MB), SMOLLM2_1_360M_QUANTIZED (200MB), SMOLLM2_1_1_7B (3.4GB), SMOLLM2_1_1_7B_QUANTIZED (900MB)

**Phi 4 Mini:** PHI_4_MINI_4B (8GB), PHI_4_MINI_4B_QUANTIZED (2GB)

**LFM 2.5:** LFM2_5_1_2B_INSTRUCT (2.4GB), LFM2_5_1_2B_INSTRUCT_QUANTIZED (650MB)

**Selection Guide:**
- Low-end (< 4GB): SMOLLM2_1_135M_QUANTIZED, QWEN3_0_6B_QUANTIZED
- Mid-range (4-6GB): LLAMA3_2_1B, QWEN2_5_1_5B_QUANTIZED
- High-end (6GB+): LLAMA3_2_3B, QWEN3_4B, PHI_4_MINI_4B
- Quick Q&A: SMOLLM2_1_360M, QWEN3_0_6B
- Advanced reasoning: LLAMA3_2_3B, QWEN3_4B
- Tool calling: LLAMA3_2_3B, QWEN2_5_3B
- Fastest inference: SMOLLM2_1_135M_QUANTIZED, QWEN3_0_6B_QUANTIZED

### 13.3 Chat Configuration

```typescript
llm.configure({
  chatConfig: {
    systemPrompt: 'You are a helpful AI assistant.',
    initialMessageHistory: [
      { role: 'user', content: 'Hello!' },
      { role: 'assistant', content: 'Hi! How can I help?' },
    ],
    contextStrategy: new SlidingWindowContextStrategy(1000, false),
  },
  toolsConfig: {
    tools: [/* tool definitions */],
    executeToolCallback: async (call) => { /* execute and return string */ },
    displayToolCalls: false,
  },
  generationConfig: {
    temperature: 0.7,
    topP: 0.9,
    outputTokenBatchSize: 10,
    batchTimeInterval: 100,
  },
});
```

**Temperature:** 0.1-0.5 (focused/factual), 0.6-0.9 (balanced), 1.0+ (creative)

**topP:** 0.9 (recommended), 0.95 (more diverse), 1.0 (no filtering)

**outputTokenBatchSize:** Controls streaming update frequency. Higher = less smooth but more efficient.

### 13.4 Context Strategies

**NoopContextStrategy:** No filtering, entire history used. For manual management or short conversations.

**MessageCountContextStrategy(n):** Keep last n messages. Simple, fast, no token counting.

**SlidingWindowContextStrategy(bufferTokens, allowOrphaned):** Token-aware, removes oldest messages to fit. Recommended for production.

```typescript
import { SlidingWindowContextStrategy } from 'react-native-executorch/utils';
llm.configure({
  chatConfig: {
    contextStrategy: new SlidingWindowContextStrategy(
      2000,  // Reserve 2000 tokens for generation
      false   // Keep user-assistant pairs together
    ),
  },
});
```

**Custom Strategy:** Implement `ContextStrategy` interface with `buildContext()` method.

### 13.5 Tool Calling

```typescript
const tools = [{
  type: 'function',
  function: {
    name: 'get_weather',
    description: 'Get weather for a location',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City name' },
        unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
      },
      required: ['location'],
    },
  },
}];

llm.configure({
  toolsConfig: {
    tools,
    executeToolCallback: async (call) => {
      if (call.toolName === 'get_weather') {
        const { location, unit } = call.arguments;
        return `Weather in ${location}: 22° ${unit || 'celsius'}`;
      }
      return null;
    },
    displayToolCalls: false,
  },
});
```

**Best Practices:** Clear tool descriptions, validate inputs, return strings, handle errors, return null for unknown tools.

---

## 14. Speech & Audio

### 14.1 Speech & Audio Overview

**Core Features:**
- **STT:** Whisper models, 96+ languages, streaming, word-level timestamps
- **TTS:** Kokoro model, multiple voices, speed control, streaming
- **VAD:** Speech segment detection, low latency, timestamp precision

**Audio Format:** 16kHz mono Float32Array (normalized -1.0 to 1.0). TTS output is 22kHz.

**Use Cases:** Voice assistant, live transcription, audiobooks, voice commands

### 14.2 Text Embeddings Overview

Text embeddings convert text into numerical vector representations capturing semantic meaning.

**Key Features:** On-device processing, real-time performance, multiple models, React integration

**Supported Models:**
- ALL_MINILM_L6_V2: 384-dimensional, general-purpose
- CLIP_VIT_BASE_PATCH32_TEXT: 512-dimensional, multimodal image-text matching

**How It Works:** Load model → Generate embeddings with `forward()` → Compare vectors with dot product/cosine similarity → Rank by similarity

### 14.3 Using Text Embeddings

```typescript
import { useTextEmbeddings, ALL_MINILM_L6_V2 } from 'react-native-executorch';

const model = useTextEmbeddings({ model: ALL_MINILM_L6_V2 });
const embedding = await model.forward('Hello world');
console.log('Dimensions:', embedding.length); // 384
```

**Parameters:** `model` (modelSource + tokenizerSource), `preventLoad` (optional)

**Returns:** `error`, `isReady`, `isGenerating`, `downloadProgress`, `forward(text)` → `Promise<Float32Array>`

### 14.4 Semantic Search

```typescript
import { useTextEmbeddings, ALL_MINILM_L6_V2 } from 'react-native-executorch';

const model = useTextEmbeddings({ model: ALL_MINILM_L6_V2 });

// Pre-compute database embeddings
const database = items.map(async (text) => ({
  text,
  embedding: await model.forward(text),
}));

// Search
const queryEmbedding = await model.forward(query);
const results = database
  .map(({ text, embedding }) => ({ text, similarity: dotProduct(queryEmbedding, embedding) }))
  .sort((a, b) => b.similarity - a.similarity)
  .slice(0, 10);
```

**Similarity Functions:**
- Dot product: `sum(a[i] * b[i])` — for normalized vectors
- Cosine similarity: `dot(a,b) / (|a| * |b|)` — general purpose

**Performance Tips:** Pre-compute database embeddings, cache query embeddings, limit result count, use similarity thresholds (≥ 0.3).

---

## 15. Lessons Learned (tarai Project)

> Practical findings from integrating React Native ExecuTorch 0.9.x with Expo SDK 56.

### 15.1 `useTextEmbeddings` Hook API

The hook returns these fields (not all are obvious):

| Field | Type | Notes |
|-------|------|-------|
| `isReady` | `boolean` | `true` when model is loaded and ready for inference |
| `isGenerating` | `boolean` | `true` during `forward()` call |
| `downloadProgress` | `number` | 0–1, but **not always populated** (HuggingFace tokenizer.json has no `Content-Length` header) |
| `error` | `RnExecutorchError \| null` | Non-null on download or inference failure |
| `forward(text)` | `Promise<Float32Array>` | Runs inference |

**No `isLoading` field exists.** Derive it:
```typescript
const isLoading = !model.isReady && !model.error && !preventLoad && model.downloadProgress < 1;
```

**No `load()` method exists.** The hook auto-loads based on `preventLoad`. To re-trigger a load, remount the hook component via a React `key`.

### 15.2 Model Cache Location

Cached files are stored at:
```
{DocumentDirectory}/react-native-executorch/
```

The `ExpoResourceFetcher` manages this directory. **Not** `executorch/` or `et_models/`.

### 15.3 Deleting Cached Models

Use the fetcher API (not raw file system operations):
```typescript
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';

// Delete specific resources by URL
await ExpoResourceFetcher.deleteResources(
  'https://.../model.pte',
  'https://.../tokenizer.json'
);
```

Other useful fetcher methods:
```typescript
const files = await ExpoResourceFetcher.listDownloadedFiles();  // string[]
const totalSize = await ExpoResourceFetcher.getFilesTotalSize('https://.../model.pte');
await ExpoResourceFetcher.cancelFetching('https://.../model.pte');
await ExpoResourceFetcher.pauseFetching('https://.../model.pte');
await ExpoResourceFetcher.resumeFetching('https://.../model.pte');
```

### 15.4 Clearing Native Memory

**Critical:** ExecuTorch loads models into native C++ memory. Deleting cached files does NOT unload from memory. The model stays `isReady: true` until the app process is killed.

To fully clear:
1. Call `ExpoResourceFetcher.deleteResources(...)` — removes files from disk
2. **Force stop** the app (Android) or kill it (iOS)
3. Reopen — native memory is fresh, files are gone → `isReady: false`

### 15.5 Preventing Infinite Render Loops

The `useEffect` that syncs hook state to provider state **must** have proper dependencies:
```typescript
// BAD — fires every render, causes infinite loop
useEffect(() => {
  onState({ isReady: model.isReady, ... });
});

// GOOD — only fires when values actually change
useEffect(() => {
  onState({ isReady: model.isReady, ... });
}, [model.isReady, model.isLoading, model.downloadProgress, model.error]);
```

### 15.6 Keyed ModelRunner Pattern

To tear down + recreate the native model without remounting the entire app tree, use a keyed component that renders `null`:
```tsx
function ModelRunner({ preventLoad, onState }) {
  const model = useTextEmbeddings({ model: MODEL, preventLoad });
  useEffect(() => { onState(model); }, [model.isReady, ...]);
  return null;
}

// In provider:
<ModelRunner key={runnerKey} preventLoad={preventLoad} onState={handleState} />
```

When `runnerKey` changes, React unmounts the old `ModelRunner` (destroying the native model) and mounts a new one.

### 15.7 Auto-Load When Cached

Check if the model is already downloaded before deciding whether to auto-load:
```typescript
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';

const files = await ExpoResourceFetcher.listDownloadedFiles();
const isCached = files.some(f => f.includes('lfm_2_5_embedding_350m'));
// If cached → setPreventLoad(false) to auto-load
// If not cached → keep preventLoad(true) and show Download button
```

### 15.8 `preventLoad` Behavior

- `preventLoad: true` (default in our code) — hook does NOT auto-download or auto-load
- `preventLoad: false` — hook immediately starts downloading if not cached, then loads

**Changing `preventLoad` does not trigger a reload.** You must remount the hook (via `key` prop) for the change to take effect.

### 15.9 Tokenizer Download Warning

```
WARN  No content-length header for .../tokenizer.json
```

This is **benign**. HuggingFace does not send `Content-Length` for `tokenizer.json`. The fetcher cannot compute a precise download percentage for this file. The download still completes successfully.

### 15.10 Recommended Settings UI Flow

```
┌─────────────────────────────────────────┐
│  Embedding (350M)                       │
│                                         │
│  [Not downloaded]  → [ Download ]       │
│  [Downloading]     → [====    ] 42%     │
│  [Ready]           → ✓ Ready  [Clear]  │
│  [Failed]          → Failed             │
└─────────────────────────────────────────┘
```

**State machine:**
1. `!isReady && !isLoading` → Show **Download** button
2. `isLoading` → Show **progress bar** + percentage
3. `isReady` → Show **Ready** badge + **Clear** button
4. `error` → Show **Failed** text

---

*This document is a comprehensive reference compiled from the official React Native ExecuTorch documentation at https://docs.swmansion.com/react-native-executorch/. For the latest updates, always refer to the official docs.*
