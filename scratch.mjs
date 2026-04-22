import pkg from '@tonejs/midi';
const { Midi } = pkg;

// Dummy MIDI
const midi = new Midi();
const track = midi.addTrack();
track.addNote({ midi: 60, time: 0, duration: 1 });

const bytes = new Uint8Array(midi.toArray());
console.log("bytes length:", bytes.length);

const CHUNK = 8192;
let b64 = '';
for (let i = 0; i < bytes.length; i += CHUNK) {
    b64 += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
}
const encoded = btoa(b64);
console.log("Encoded:", encoded.substring(0, 50));

const decoded = atob(encoded);
const back = new Uint8Array(decoded.length);
for (let i = 0; i < decoded.length; i++) back[i] = decoded.charCodeAt(i);
console.log("Match?", bytes.every((v, i) => v === back[i]));
