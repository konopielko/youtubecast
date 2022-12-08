import { Source, Video } from '../types';
import cacheService from './cacheService';
import { getVideoIdsForPlaylist as getVideoIdsForPlaylistWithoutAPI } from './playlistService';
import { searchChannels } from './searchService';
import {
  getChannelDetails,
  getPlaylistDetails,
  getVideoDetails,
  getVideoIdsForPlaylist,
} from './youtubeService';

const searchForSource = async (searchText: string): Promise<Source> => {
  searchText = searchText
    .trim()
    .replace(/http(s){0,1}:\/\//i, '')
    .replace(/.*youtube\.com/i, 'youtube.com')
    .replace(/youtube\.com\/channel\//i, '')
    .replace(/youtube\.com\/.*(\?|\&)list=([^\&]+)/i, '$2');

  const cacheKey = `source-id-search-${searchText}`;
  const cacheResult = await cacheService.get<string>(cacheKey);

  const sourceId =
    cacheResult ??
    (searchText.match(/^(UC[-_a-z0-9]{22}|PL[-_a-z0-9]{32}|UU[-_a-z0-9]{24})$/i)
      ? searchText
      : await searchChannels(searchText));

  if (!sourceId) throw `Could not find YouTube channel for ${searchText} 🤷`;

  await cacheService.set(cacheKey, sourceId, 86400);

  const source = await getSourceData(sourceId);

  return source;
};

const getSourceData = async (id: string): Promise<Source> => {
  const cacheKey = `source-${id}`;
  const cacheResult = await cacheService.get<Source>(cacheKey);
  if (cacheResult) return cacheResult;

  const source = id.startsWith('UC')
    ? await getChannelDetails(id)
    : id.startsWith('PL') || id.startsWith('UU')
    ? await getPlaylistDetails(id)
    : null;

  if (!source) throw `Could not find a YouTube source for id ${id} 🤷`;

  await cacheService.set(cacheKey, source, 86400);
  return source;
};

const getVideos = async (sourceId: string): Promise<Video[]> => {
  const cacheKey = `source-videos-${sourceId}`;
  const cacheResult = await cacheService.get<Video[]>(cacheKey);
  if (cacheResult) return cacheResult;

  const isChannel = sourceId.startsWith('UC');
  const playlistId = sourceId.replace(/^UC/, 'UU');

  const videoIds =
    (isChannel ? await getVideoIdsForPlaylistWithoutAPI(playlistId) : undefined) ??
    (await getVideoIdsForPlaylist(playlistId));

  const videos = await getVideoDetails(videoIds);
  await cacheService.set(cacheKey, videos, 600);
  return videos;
};

export { searchForSource, getSourceData, getVideos };
