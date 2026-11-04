/**
 * AI provider selection for natural-language project updates.
 *
 * Default: the built-in offline language engine (`localNlpProvider`) —
 * deterministic, free, no keys.
 *
 * Optional remote LLM: set `VITE_AI_UPDATE_ENDPOINT` to a server-side proxy
 * you control. The frontend POSTs `{ input, context }` and expects
 * `{ proposal }` matching the AiProposal schema — responses are validated
 * before use. API keys live on the proxy server, never in this bundle.
 */

import { localNlpProvider, validateProposal, type AiProposal, type AiUpdateProvider, type AnalyzeContext } from './aiUpdate'

const ENDPOINT = (import.meta.env.VITE_AI_UPDATE_ENDPOINT ?? '').trim()
const TIMEOUT_MS = 20_000

const httpProvider: AiUpdateProvider = {
  name: 'remote AI service',
  async analyze(input: string, ctx: AnalyzeContext): Promise<AiProposal> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, context: { project: ctx.project, latestUpdate: ctx.latestUpdate, openRaids: ctx.openRaids } }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`AI service responded ${res.status}`)
      const body = await res.json()
      const proposal = body?.proposal ?? body
      if (!validateProposal(proposal)) throw new Error('AI service returned an invalid proposal')
      return proposal
    } finally {
      clearTimeout(timer)
    }
  },
}

export function getAiProvider(): AiUpdateProvider {
  return ENDPOINT ? httpProvider : localNlpProvider
}
