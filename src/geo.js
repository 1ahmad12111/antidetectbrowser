'use strict';

const http = require('http');
const https = require('https');
const net = require('net');

// Map country code → browser language string
const COUNTRY_TO_LANG = {
  US: 'en-US', GB: 'en-GB', AU: 'en-AU', CA: 'en-CA', NZ: 'en-NZ', IE: 'en-IE',
  DE: 'de-DE', AT: 'de-AT', CH: 'de-CH',
  FR: 'fr-FR', BE: 'fr-BE',
  ES: 'es-ES', MX: 'es-MX', AR: 'es-AR', CO: 'es-CO',
  IT: 'it-IT',
  PT: 'pt-PT', BR: 'pt-BR',
  NL: 'nl-NL',
  PL: 'pl-PL',
  RU: 'ru-RU',
  JP: 'ja-JP',
  KR: 'ko-KR',
  CN: 'zh-CN', TW: 'zh-TW', HK: 'zh-HK',
  IN: 'hi-IN',
  TR: 'tr-TR',
  SA: 'ar-SA', AE: 'ar-AE',
  SE: 'sv-SE', NO: 'nb-NO', DK: 'da-DK', FI: 'fi-FI',
  CZ: 'cs-CZ', SK: 'sk-SK', HU: 'hu-HU', RO: 'ro-RO',
  UA: 'uk-UA', GR: 'el-GR', IL: 'he-IL', TH: 'th-TH',
  ID: 'id-ID', VN: 'vi-VN', PH: 'en-PH', SG: 'en-SG',
  ZA: 'en-ZA', NG: 'en-NG', KE: 'en-KE',
};

function parseProxy(proxyUrl) {
  // Handles: http://host:port, https://host:port, socks5://host:port, host:port
  let url = proxyUrl;
  if (!url.includes('://')) url = 'http://' + url;
  const u = new URL(url);
  return {
    protocol: u.protocol.replace(':', ''),
    host: u.hostname,
    port: parseInt(u.port, 10),
    username: u.username || null,
    password: u.password || null,
  };
}

// Make a GET request through an HTTP/HTTPS proxy (CONNECT tunnel for HTTPS, direct for HTTP)
function getViaHttpProxy(proxy, targetUrl) {
  return new Promise((resolve, reject) => {
    const target = new URL(targetUrl);
    const isHttps = target.protocol === 'https:';

    if (isHttps) {
      // CONNECT tunnel
      const req = http.request({
        host: proxy.host,
        port: proxy.port,
        method: 'CONNECT',
        path: `${target.hostname}:443`,
        headers: proxy.username
          ? { 'Proxy-Authorization': 'Basic ' + Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64') }
          : {},
      });
      req.on('connect', (res, socket) => {
        const tlsSocket = require('tls').connect({ socket, servername: target.hostname }, () => {
          const innerReq = https.request({ hostname: target.hostname, path: target.pathname + target.search, socket: tlsSocket, agent: false }, innerRes => {
            let data = '';
            innerRes.on('data', d => data += d);
            innerRes.on('end', () => resolve(data));
          });
          innerReq.on('error', reject);
          innerReq.end();
        });
      });
      req.on('error', reject);
      req.end();
    } else {
      // Plain HTTP proxy — pass full URL as path
      const req = http.request({
        host: proxy.host,
        port: proxy.port,
        method: 'GET',
        path: targetUrl,
        headers: {
          Host: target.hostname,
          ...(proxy.username
            ? { 'Proxy-Authorization': 'Basic ' + Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64') }
            : {}),
        },
      });
      req.on('response', res => {
        let data = '';
        res.on('data', d => data += d);
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.end();
    }
  });
}

// Make a GET request through a SOCKS5 proxy
function getViaSocks5Proxy(proxy, targetUrl) {
  return new Promise((resolve, reject) => {
    try {
      const { SocksProxyAgent } = require('socks-proxy-agent');
      const target = new URL(targetUrl);
      const agentUrl = `socks5://${proxy.username ? `${proxy.username}:${proxy.password}@` : ''}${proxy.host}:${proxy.port}`;
      const agent = new SocksProxyAgent(agentUrl);
      const mod = target.protocol === 'https:' ? https : http;
      const req = mod.request({ hostname: target.hostname, path: target.pathname + target.search, agent }, res => {
        let data = '';
        res.on('data', d => data += d);
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.end();
    } catch {
      reject(new Error('socks-proxy-agent not installed. Run: npm install socks-proxy-agent'));
    }
  });
}

// Detect geolocation of the proxy's exit IP using ip-api.com
async function detectProxyGeo(proxyUrl) {
  const proxy = parseProxy(proxyUrl);
  const isSocks = proxy.protocol.startsWith('socks');

  let raw;
  try {
    const apiUrl = 'http://ip-api.com/json?fields=status,country,countryCode,city,regionName,lat,lon,timezone,query';
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('geo request timed out after 10s')), 10000));
    if (isSocks) {
      raw = await Promise.race([getViaSocks5Proxy(proxy, apiUrl), timeout]);
    } else {
      raw = await Promise.race([getViaHttpProxy(proxy, apiUrl), timeout]);
    }
  } catch (err) {
    throw new Error(`Could not reach geo API through proxy: ${err.message}`);
  }

  const data = JSON.parse(raw);
  if (data.status !== 'success') {
    throw new Error(`Geo API returned: ${data.message || data.status}`);
  }

  const language = COUNTRY_TO_LANG[data.countryCode] || 'en-US';

  return {
    ip: data.query,
    city: data.city,
    region: data.regionName,
    country: data.country,
    countryCode: data.countryCode,
    timezone: data.timezone,
    language,
    lat: data.lat,
    lon: data.lon,
  };
}

module.exports = { detectProxyGeo };
