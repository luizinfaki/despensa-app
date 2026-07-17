import Anthropic from '@anthropic-ai/sdk'

let _client = null

export function getAnthropic() {
  if (!_client) {
    _client = new Anthropic()
  }
  return _client
}
