# Local AI Inference on Mac Silicon from Node.js/TypeScript - Research Summary

*Research conducted via vibe-tools web - August 2024*

## Executive Summary

The best options for running local AI inference on Apple Silicon (M1, M2, M3, M4) from Node.js and TypeScript are:

1. **Ollama** - Best overall for ease of use and developer experience
2. **Apple's MLX/MLX-LM** - Best for cutting-edge performance and Apple-native optimization
3. **llama.cpp wrappers** - Best for raw performance and custom pipelines

## Detailed Analysis

### 1. Ollama - Recommended for Most Developers

**Performance:** High (Apple GPU optimized)
- 7B models: ~23 tokens/sec (fp16), ~61 tokens/sec (4-bit quantized)
- Supports M1-M4 chips with Metal acceleration
- Handles 2B-7B models comfortably; higher-end machines can run 13B+ models

**Ease of Use:** Excellent
- Install as background service, interact via HTTP API
- Official npm package: `ollama`
- Full TypeScript support with streaming and function calling
- No machine learning expertise required

**Model Support:** Large and growing
- Curated library: Llama 2, Mistral, Phi, CodeLlama, etc.
- Community/quantized models from Hugging Face
- Recent M4 chip support and model library expansions

**Model Registry & Custom Models:**
- **Default Models:** Bundled GGUF models available via `ollama list`
- **Custom Models:** Import GGUF from Hugging Face or create custom Modelfiles
- **Supported Formats:** GGUF (primary), requires conversion from PyTorch/safetensors
- **Adding Models:** Download GGUF files, place in `~/.ollama/models/`, create Modelfile, register with `ollama create`

**Node.js Integration:**
```typescript
import ollama from 'ollama'

// Basic usage
const response = await ollama.chat({
  model: 'llama3.1',
  messages: [{ role: 'user', content: 'Why is the sky blue?' }],
})

// Streaming support
const response = await ollama.chat({
  model: 'llama3.1',
  messages: [{ role: 'user', content: 'Why is the sky blue?' }],
  stream: true,
})
for await (const part of response) {
  process.stdout.write(part.message.content)
}
```

**Limitations:** RAM limits large model sizes; Metal-dependent GPU acceleration

### 2. Apple MLX/MLX-LM - Best Performance

**Performance:** Very High (native Metal GPU)
- 7B models: ~19 tokens/sec (fp16), ~31 tokens/sec (4-bit quantized)
- Native Metal-backed GPU computation with real-time speeds
- Highly tuned for Apple's unified memory and optimized kernel fusion

**Ease of Use:** Moderate (Python-heavy)
- Requires Python interaction
- Node.js bindings emerging but not yet polished
- Typically accessed via REST/gRPC or Node.js FFI to bridge Python

**Model Support:** Growing rapidly
- Fastest adoption of Apple's foundation models
- Growing Hugging Face coverage
- Strong versioning/reproducibility for regulated environments

**Model Registry & Custom Models:**
- **Default Models:** No official registry; discover via LM Studio and community
- **Custom Models:** Import safetensors from Hugging Face, conversion may be needed
- **Supported Formats:** MLX safetensors (primary), no GGUF support
- **Adding Models:** Download safetensors, use MLX CLI for fine-tuning/inference

**Recent Developments (2024):**
- Improved multi-node parallel inference across Mac Studios
- Upgraded Apple foundation model support
- New APIs for fine-tuned model management

**Limitations:** Developer tools are more Pythonic; direct TypeScript SDKs limited

**Available Node.js Packages:**

#### @frost-beta/mlx (node-mlx)
- **npm:** `@frost-beta/mlx`
- **GitHub:** frost-beta/node-mlx
- **Status:** Experimental, unofficial, but actively maintained
- **Features:** Node-API bindings for MLX, GPU support for Apple Silicon, CPU support for x64 Macs and Linux
- **Use Cases:** Simple text, vision models, and Llama 3 implementations for JavaScript/TypeScript

#### Related frost-beta packages:
- **@frost-beta/llm** - Node.js module providing inference APIs for large language models with CLI
- **@frost-beta/clip** - Compute embeddings of text/images with CLIP model
- **@frost-beta/sisi** - Semantic image search, locally without Internet
- **llama3** - JavaScript implementation of Llama 3 using node-mlx

#### react-native-mlx
- **npm:** `react-native-mlx`
- **Status:** Very early stage (v0.0.1)
- **Use Cases:** React Native applications requiring MLX functionality

### 3. llama.cpp Wrappers - Best Raw Performance

**Performance:** High (quantized models)
- 7B models: ~23 tokens/sec (fp16), ~61 tokens/sec (4-bit quantized)
- Fastest model loading times
- Metal acceleration support

**Ease of Use:** Moderate
- Lower-level than Ollama
- Requires CMake and compatible model files (GGUF format)
- Good for experimentation and custom TS app integration

**Available Node.js Packages:**

#### llama.cpp-ts
- **npm:** `llama.cpp-ts`
- **GitHub:** developer239/llama.cpp-ts
- Full TypeScript support with async streaming
- Fast updates and GGUF support

```typescript
const { Llama } = require('llama.cpp-ts');

async function main() {
    const llama = new Llama();
    const modelPath = "./path/to/your/model.gguf";

    if (!llama.initialize(modelPath, { nGpuLayers: 32 }, { nContext: 2048 })) {
        console.error("Failed to initialize the model");
        return;
    }
    
    const tokenStream = llama.prompt("What is the capital of France?");
    while (true) {
        const token = await tokenStream.read();
        if (token === null) break;
        process.stdout.write(token);
    }
}
```

#### node-llama-cpp
- **npm:** `node-llama-cpp`
- **GitHub:** withcatai/node-llama-cpp
- Prebuilt binaries with Metal acceleration
- Schema enforcement and function calling
- CLI and embeddings support

## Performance Benchmarks (2024)

### Token Generation Speed
| Model Variant | llama.cpp | MLX | Ollama |
|---------------|-----------|-----|---------|
| Llama 2 7B fp16 | ~23 token/s | ~19 token/s | ~23 token/s |
| Llama 2 7B 4-bit quant | ~61 token/s | ~31 token/s | ~61 token/s |
| Prompt processing | ~772 token/s | ~652 token/s | ~750 token/s |

### Memory Usage
- **fp16, Llama 2 7B:** ~16 GB RAM (~12.5 GB for model weights)
- **4-bit quantized, Llama 2 7B:** ~6 GB RAM (~3.5 GB for weights)

### Model Size Limitations
- **M1/M2 base (8-16GB RAM):** 7B to 13B models in lower-precision formats
- **M3 Max/Ultra, M4:** Up to 70B models in quantized formats (requires 64GB+ RAM)

## Recommendations

### For Node.js/TypeScript Developers Prioritizing Ease of Use
**Choose Ollama** - Best balance of performance, ease of use, and robust local LLMs

### For Maximum Performance and Apple-Native Optimization
**Choose MLX/MLX-LM** - Bridge into Node.js as needed via REST/gRPC or FFI

### For Custom Pipelines and Experimental Setups
**Choose llama.cpp wrappers** - Best raw performance and flexibility

### For Small Models or Browser-First Workflows
**Consider transformers.js** - Native JS/TS but no Metal acceleration, not suited for heavy LLM workloads

## Model Registries & Custom Model Support

### Ollama Model Registry

**Default Models:**
- Ships with curated popular models (llama2, mistral, phi, etc.)
- Available via `ollama list` command
- All models use GGUF format for optimal performance

**Adding Custom Models:**
1. **Convert Hugging Face models to GGUF:**
   ```bash
   # Example with llama.cpp
   python convert.py --input-dir /path/to/hf/model --output /path/to/model.gguf
   ```

2. **Add to Ollama directory:**
   ```bash
   mv model.gguf ~/.ollama/models/custom-model/
   ```

3. **Create Modelfile and register:**
   ```dockerfile
   FROM custom-model.gguf
   # Optional: Add instructions, parameters
   ```
   ```bash
   ollama create my-custom-model -f Modelfile
   ollama run my-custom-model
   ```

**Supported Formats:** GGUF (primary), requires conversion from PyTorch/safetensors

### MLX Model Registry

**Default Models:**
- No centralized registry like Ollama
- Models discovered via LM Studio and community
- Focus on MLX safetensors format

**Adding Custom Models:**
1. **Download from Hugging Face:**
   ```bash
   huggingface-cli login
   huggingface-cli download <repo>/<model> --local-dir ./model
   ```

2. **Use with MLX CLI:**
   ```bash
   mlx_lm.lora --train --model mistralai/Mistral-7B-v0.1 --data ./data/mydata.jsonl --batch-size 16
   ```

**Supported Formats:** MLX safetensors (primary), no GGUF support

### Format Comparison: GGUF vs MLX Safetensors

| Aspect | GGUF | MLX Safetensors |
|--------|------|------------------|
| **Purpose** | Optimized for inference with quantization | Generalized tensor storage for training/inference |
| **Compatibility** | Ollama, llama.cpp | MLX, Hugging Face ecosystem |
| **Conversion** | Cannot convert to MLX safetensors | Can use directly if structure matches |
| **Use Case** | Fast inference, lightweight | Training, fine-tuning, inference |
| **File Structure** | Bundles weights, vocab, metadata | Raw or quantized tensors |

### Key Differences

- **GGUF**: Designed for efficient inference on CPUs/GPUs, bundles model weights, vocab, and metadata in a single file
- **MLX Safetensors**: Generalized binary format for storing tensors safely, used for both training and inference with MLX

**Note:** Models for Ollama and MLX are not directly cross-compatible due to format differences. Manual conversion is required between GGUF and MLX safetensors formats.

## Future Outlook

Apple Silicon's rapid hardware and software advances (M4, upgraded Metal APIs, improved memory stacking) are expected to keep improving local AI inference performance throughout 2024 and beyond. MLX is likely to see improved Node.js bindings as the ecosystem matures.

## References

- [ollama/ollama-js](https://github.com/ollama/ollama-js) - Official Ollama JavaScript client
- [developer239/llama.cpp-ts](https://github.com/developer239/llama.cpp-ts) - TypeScript bindings for llama.cpp
- [withcatai/node-llama-cpp](https://github.com/withcatai/node-llama-cpp) - Node.js wrapper for llama.cpp
- [Apple MLX](https://github.com/ml-explore/mlx) - Apple's machine learning framework
- [frost-beta/node-mlx](https://github.com/frost-beta/node-mlx) - Experimental Node.js bindings for MLX
- [@frost-beta/mlx](https://www.npmjs.com/package/@frost-beta/mlx) - npm package for MLX Node.js bindings
- [@frost-beta/llm](https://www.npmjs.com/package/@frost-beta/llm) - npm package for LLM inference APIs
