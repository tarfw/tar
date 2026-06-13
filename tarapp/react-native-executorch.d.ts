declare module 'react-native-executorch' {
  export class TextEmbeddingsModule {
    load(config: { modelSource: any; tokenizerSource: any }): Promise<void>;
    forward(text: string): Promise<Float32Array | number[]>;
  }
  export function useLLM(config: any): any;
  export const ResourceFetcher: any;
  export const SSDLITE_320_MOBILENET_V3_LARGE: any;
  export const CLIP_VIT_BASE_PATCH32_IMAGE: any;
}
