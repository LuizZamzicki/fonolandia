// Microfone: percebe sozinho quando a criança começa e termina um som e entrega cada trecho gravado.
// Tudo no aparelho (sem internet). Precisa de endereço seguro (https ou localhost).

import { Segmenter } from './segmenter'

export function micSupported(): boolean {
  return Boolean(navigator.mediaDevices?.getUserMedia) && window.isSecureContext
}

export interface Mic {
  stop(): void
}

export interface MicOptions {
  onSegment: (samples: Float32Array, sampleRate: number) => void
  /** Volume atual (0 a 1), para o medidor na tela. */
  onLevel?: (level: number) => void
}

const BUFFER = 2048

export async function openMic({ onSegment, onLevel }: MicOptions): Promise<Mic> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      // Tira o som do próprio aparelho (a voz do Tuca e os efeitos) do que o microfone ouve
      echoCancellation: true,
      // A redução de ruído apaga o "ssss" e o "ffff" (parecem chiado), por isso fica desligada
      noiseSuppression: false,
      autoGainControl: true,
    },
  })
  const ctx = new AudioContext()
  if (ctx.state === 'suspended') await ctx.resume()
  const source = ctx.createMediaStreamSource(stream)
  // ScriptProcessor é antigo, mas funciona em todos os navegadores (inclusive no iPad)
  const processor = ctx.createScriptProcessor(BUFFER, 1, 1)
  const mute = ctx.createGain()
  mute.gain.value = 0
  source.connect(processor)
  processor.connect(mute).connect(ctx.destination)

  const segmenter = new Segmenter(ctx.sampleRate, onSegment)
  processor.onaudioprocess = (e) => {
    const rms = segmenter.push(new Float32Array(e.inputBuffer.getChannelData(0)))
    onLevel?.(Math.min(1, rms * 8))
  }

  return {
    stop() {
      processor.onaudioprocess = null
      source.disconnect()
      processor.disconnect()
      stream.getTracks().forEach((t) => t.stop())
      void ctx.close()
    },
  }
}
