class EncodingService {
    constructor(private encoder: TextEncoder, private decoder: TextDecoder) {}

    encode(decoded: string): Uint8Array {
        return this.encoder.encode(decoded);
    }

    decode(encoded: Uint8Array): string {
        return this.decoder.decode(encoded);
    }
}

export default EncodingService;