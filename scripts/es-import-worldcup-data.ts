/**
 * Import World Cup test data into ES research-docs index
 *
 * Run with:
 *   set -a && source .env && set +a && npx tsx scripts/es-import-worldcup-data.ts
 */

import { Client } from '@elastic/elasticsearch';

const WORLD_CUP_DOCS = [
  {
    title: 'FIFA World Cup 2026 — Host Cities and Schedule Overview',
    url: 'https://www.fifa.com/worldcup/2026/overview',
    content: `The 2026 FIFA World Cup will be jointly hosted by the United States, Mexico, and Canada. This marks the first time three nations co-host the tournament. The expanded format features 48 teams in 12 groups of four, with the top two from each group plus eight best third-placed teams advancing. Key host cities include New York/New Jersey (MetLife Stadium, final venue), Los Angeles (SoFi Stadium), Dallas (AT&T Stadium), and Mexico City (Estadio Azteca). The tournament runs from June 11 to July 19, 2026.`,
  },
  {
    title: '2026 世界杯夺冠热门分析：巴西、法国、阿根廷三强争霸',
    url: 'https://sports.example.com/worldcup-2026-favorites',
    content: `2026年世界杯热门球队分析：巴西队在主教练安切洛蒂的带领下重返巅峰，拥有维尼修斯、恩德里克等新生代球星，夺冠赔率约4.5倍。法国队虽然姆巴佩逐渐老化，但中场深度无与伦比，赔率约5.0倍。阿根廷队作为卫冕冠军，梅西虽已退出国家队，但阿尔瓦雷斯、加纳乔等人接班，赔率约6.0倍。英格兰队近年稳步上升，贝林厄姆领衔，赔率约7.0倍。东道主美国队享有主场优势，赔率约12.0倍。`,
  },
  {
    title: 'World Cup 2026 Group Stage Draw Predictions',
    url: 'https://football-analysis.example.com/2026-draw',
    content: `Analysis of potential Group Stage draws for the 2026 World Cup. With 48 teams divided into 12 groups, the probability of "groups of death" increases significantly. Historical data suggests that host nations (USA, Mexico, Canada) are seeded into separate groups. Key matchups to watch: Brazil vs Germany, France vs England, Argentina vs Spain. Statistical models from various betting agencies suggest Brazil (18.2%), France (14.5%), Argentina (12.8%), and England (10.1%) as top favorites based on current form and squad depth.`,
  },
  {
    title: '世界杯历史数据：东道主优势有多大？',
    url: 'https://sports-data.example.com/host-advantage',
    content: `历史数据显示，世界杯东道主拥有显著优势。自1930年至今，东道主夺冠概率约为29%（6次中的21次），远高于随机概率。其中巴西1950年虽为东道主但在决赛中失利（马拉卡纳惨案），2014年则在半决赛1-7惨败于德国。2022年卡塔尔作为东道主在小组赛出局，打破了东道主至少进入16强的历史规律。对于2026年，美国、墨西哥和加拿大三队均自动获得小组赛种子席位。`,
  },
  {
    title: 'AI-Powered Prediction Models for FIFA World Cup 2026',
    url: 'https://ml-sports.example.com/worldcup-2026-ai',
    content: `Machine learning models incorporating 150+ features (FIFA rankings, player market value, recent form, squad age profile, historical performance) predict the following probabilities for the 2026 World Cup: Brazil 19.3%, France 15.7%, Argentina 11.2%, England 9.8%, Spain 8.4%, Germany 7.1%, Portugal 5.3%, Netherlands 4.2%, USA 3.8%. The models use ensemble methods combining gradient boosting (XGBoost), neural networks, and Elo rating systems. Key insight: squad depth matters more in 48-team formats due to increased match load.`,
  },
  {
    title: '2026年世界杯参赛队伍完整名单与FIFA排名',
    url: 'https://fifa-data.example.com/2026-qualified-teams',
    content: `2026年世界杯48支参赛队伍已基本确定。欧洲区（16队）：法国、英格兰、西班牙、德国、葡萄牙、荷兰、比利时、意大利、克罗地亚、瑞士等。南美区（6队）：阿根廷、巴西、乌拉圭、哥伦比亚、厄瓜多尔、巴拉圭。中北美区（6队+3东道主）：美国、墨西哥、加拿大、牙买加、洪都拉斯等。亚洲区（8队）：日本、韩国、澳大利亚、伊朗、沙特等。非洲区（9队）：摩洛哥、尼日利亚、塞内加尔、喀麦隆等。`,
  },
  {
    title: 'Betting Odds Analysis: World Cup 2026 Winner Markets',
    url: 'https://betting-analysis.example.com/worldcup-2026',
    content: `Current betting market analysis for the 2026 FIFA World Cup winner. Major bookmakers consensus: Brazil +450 (implied probability 18.2%), France +500 (16.7%), Argentina +600 (14.3%), England +700 (12.5%), Spain +800 (11.1%), Germany +1000 (9.1%). Notable value picks: USA +1200 (7.7%, boosted by home advantage), Colombia +2500 (3.8%, dark horse). Market movements since qualification: Brazil shortened from +550 to +450 after Ancelotti appointment; England lengthened from +600 to +700 after poor recent results.`,
  },
  {
    title: '世界杯冠军预测：关键因素与数据驱动分析',
    url: 'https://data-sports.example.com/worldcup-key-factors',
    content: `影响世界杯冠军的关键因素分析：1) 球队整体实力（FIFA排名加权30%）2) 球员个人能力（转会市场总价值加权20%）3) 近期比赛表现（最近20场胜率加权15%）4) 教练战术体系（进攻/防守平衡度加权15%）5) 东道主优势（本土球迷支持加权10%）6) 伤病与停赛情况（关键球员可用性加权10%）。综合以上因素，巴西得分最高（87.3分），其次是法国（84.1分）、阿根廷（81.5分）、英格兰（79.2分）。`,
  },
];

async function main() {
  const cloudId = process.env.ES_CLOUD_ID;
  const apiKey = process.env.ES_API_KEY;

  if (!cloudId || !apiKey) {
    console.error('Missing ES_CLOUD_ID or ES_API_KEY');
    process.exit(1);
  }

  const client = new Client({
    cloud: { id: cloudId },
    auth: { apiKey },
  });

  console.log('\n=== Importing World Cup Data into ES ===\n');

  const operations = WORLD_CUP_DOCS.flatMap((doc, i) => [
    { index: { _index: 'research-docs', _id: `worldcup-${i + 1}` } },
    doc,
  ]);

  const bulkResponse = await client.bulk({ body: operations, refresh: true });

  if (bulkResponse.errors) {
    console.error('Some items failed:');
    for (const item of bulkResponse.items) {
      if (item.index?.error) {
        console.error(`  ${item.index._id}: ${item.index.error.reason}`);
      }
    }
  }

  const successCount = bulkResponse.items.filter((i) => i.index?.status === 201 || i.index?.status === 200).length;
  console.log(`  Imported: ${successCount} / ${WORLD_CUP_DOCS.length} documents`);

  // Verify
  const count = await client.count({ index: 'research-docs' });
  console.log(`  Total docs in research-docs: ${count.count}`);

  // Test BM25 search
  const results = await client.search({
    index: 'research-docs',
    body: {
      size: 3,
      query: { match: { content: '世界杯冠军预测' } },
    },
  });

  console.log(`\n  BM25 test "世界杯冠军预测": ${results.hits.hits.length} hits`);
  for (const hit of results.hits.hits) {
    const src = hit._source as { title: string };
    console.log(`    ${hit._score?.toFixed(2)} — ${src.title}`);
  }

  console.log('\n=== Import Complete ===\n');
}

main().catch(console.error);
