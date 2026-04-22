import { midiBufferToMusicXml } from './app/utils/midiToMusicXml';
import { Midi } from '@tonejs/midi';

// Dummy MIDI
const midi = new Midi();
const track = midi.addTrack();
track.addNote({ midi: 60, time: 0, duration: 1 });

const bytes = new Uint8Array(midi.toArray());
console.log(midiBufferToMusicXml(bytes.buffer));
