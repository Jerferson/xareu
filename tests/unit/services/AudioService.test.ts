import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { AudioService } from '../../../src/services/AudioService'

describe('AudioService', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xareu-audio-'))
    fs.writeFileSync(path.join(tmpDir, 'latido-unico.mp3'), 'fake')
    fs.writeFileSync(path.join(tmpDir, 'bem-ti-vi.mp3'), 'fake')
    fs.writeFileSync(path.join(tmpDir, 'aplausos.mp3'), 'fake')
    // Arquivos não-mp3 que devem ser ignorados
    fs.writeFileSync(path.join(tmpDir, 'imagem.png'), 'fake')
    fs.writeFileSync(path.join(tmpDir, 'README.txt'), 'fake')
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('listAvailableAudios retorna apenas mp3, sem extensão', () => {
    const service = new AudioService(tmpDir)
    const audios = service.listAvailableAudios().sort()
    expect(audios).toEqual(['aplausos', 'bem-ti-vi', 'latido-unico'])
  })

  it('listAudioFiles ignora arquivos não-mp3 (PNG, TXT)', () => {
    const service = new AudioService(tmpDir)
    const files = service.listAudioFiles()
    expect(files).toHaveLength(3)
    expect(files.every((f) => f.endsWith('.mp3'))).toBe(true)
  })

  it('findBestMatch retorna match exato quando existe', () => {
    const service = new AudioService(tmpDir)
    const result = service.findBestMatch('latido-unico')
    expect(result?.fileName).toBe('latido-unico.mp3')
  })

  it('findBestMatch retorna match parcial', () => {
    const service = new AudioService(tmpDir)
    const result = service.findBestMatch('latido')
    expect(result?.fileName).toBe('latido-unico.mp3')
  })

  it('findBestMatch é case-insensitive', () => {
    const service = new AudioService(tmpDir)
    const result = service.findBestMatch('BEM-TI-VI')
    expect(result?.fileName).toBe('bem-ti-vi.mp3')
  })

  it('findBestMatch retorna null para query vazia', () => {
    const service = new AudioService(tmpDir)
    expect(service.findBestMatch('')).toBeNull()
    expect(service.findBestMatch('   ')).toBeNull()
  })

  it('findBestMatch nunca retorna PNG/TXT mesmo com nome similar', () => {
    const service = new AudioService(tmpDir)
    const result = service.findBestMatch('imagem')
    expect(result?.fileName.endsWith('.mp3')).toBe(true)
  })

  it('listAudioFiles retorna [] quando pasta não existe', () => {
    const service = new AudioService(path.join(tmpDir, 'nao-existe'))
    expect(service.listAudioFiles()).toEqual([])
  })

  describe('searchAudios', () => {
    beforeEach(() => {
      // pasta com nomes que cobrem diferentes posições da substring
      fs.writeFileSync(path.join(tmpDir, 'ria-de-mim.mp3'), 'fake')
      fs.writeFileSync(path.join(tmpDir, 'padaria.mp3'), 'fake')
      fs.writeFileSync(path.join(tmpDir, 'para-sempre-eu-queria-voce.mp3'), 'fake')
      fs.writeFileSync(path.join(tmpDir, 'algo-sem-relacao.mp3'), 'fake')
    })

    it('casa substring em qualquer posição (início, meio, fim)', () => {
      const service = new AudioService(tmpDir)
      const results = service.searchAudios('ria').map((m) => m.fileName)
      expect(results).toContain('ria-de-mim.mp3')
      expect(results).toContain('padaria.mp3')
      expect(results).toContain('para-sempre-eu-queria-voce.mp3')
    })

    it('matches contendo a substring vêm antes dos não-matches', () => {
      const service = new AudioService(tmpDir)
      const results = service.searchAudios('ria').map((m) => m.fileName)
      const algoIdx = results.indexOf('algo-sem-relacao.mp3')
      const padariaIdx = results.indexOf('padaria.mp3')
      expect(padariaIdx).toBeLessThan(algoIdx)
    })

    it('respeita o limit', () => {
      const service = new AudioService(tmpDir)
      expect(service.searchAudios('ria', 2)).toHaveLength(2)
    })

    it('query vazia retorna todos ordenados alfabeticamente', () => {
      const service = new AudioService(tmpDir)
      const results = service.searchAudios('').map((m) => m.fileName)
      const sorted = [...results].sort((a, b) => a.localeCompare(b))
      expect(results).toEqual(sorted)
    })

    it('é case-insensitive', () => {
      const service = new AudioService(tmpDir)
      const results = service.searchAudios('RIA').map((m) => m.fileName)
      expect(results).toContain('padaria.mp3')
    })
  })
})
