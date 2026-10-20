import { Config } from '@remotion/cli/config';

// Delivery master: H.264 high quality, yuv420p for universal playback.
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setCodec('h264');
Config.setCrf(14);
Config.setPixelFormat('yuv420p');
Config.setConcurrency(4);
Config.setChromiumOpenGlRenderer('angle');
