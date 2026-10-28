/* 中文 for TT Rainbow Climb. The page translates itself from this dictionary (kit/lang.js); names stay English. */
(function () {
  const ISLANDS = { 'FLOWER ISLAND': '花花小岛', 'TOY ISLAND': '玩具小岛', 'CANDY ISLAND': '糖果小岛', 'CLOUD ISLAND': '云朵小岛' };
  const I = (s) => ISLANDS[s] || s;
  Kit.lang.keep(['TEDDY', 'TOMMY', 'FOXY', 'FROGGY', 'Teddy', 'Tommy', 'Foxy', 'Froggy', RC.TITLE, 'Claude Code', 'Esc']);
  Kit.lang.add(Object.assign({}, ISLANDS, {
    // title
    'Throw a rainbow, walk up it, beat the water to the top!': '扔出彩虹，走上去，比水先爬到顶！',
    PLAYERS: '玩家', CLIMBER: '谁来爬', LEVEL: '难度', ISLAND: '小岛',
    'your brother comes when you call': '一叫兄弟就来帮忙',
    'Teddy & Tommy climb together': 'Teddy 和 Tommy 一起爬',
    'boxing champ': '拳击冠军', 'peace sign pro': '比耶高手',
    'slow water · double rainbows · 5 lives': '水涨得慢 · 双彩虹 · 5 条命',
    'faster water · 3 lives': '水涨得快 · 3 条命',
    'CLIMB IT TO OPEN THE NEXT': '爬完就能开下一座小岛',
    'Easier island': '简单一点的小岛', 'Harder island': '难一点的小岛',
    Players: '玩家', Climber: '谁来爬', Difficulty: '难度',
    '▶ CLIMB!': '▶ 开爬！',
    'throw a rainbow': '扔彩虹', 'break the rainbow you stand on': '踩碎脚下的彩虹',
    "◀ ▶ walk, 🌈 throws a rainbow you can walk up, ⤴️ jumps (jump on a rainbow to break it). Tap your brother's face to call him!": '◀ ▶ 走路，🌈 扔出能走上去的彩虹，⤴️ 跳（跳到彩虹上就能把它踩碎）。点兄弟的脸叫他来！',
    '↻ Turn sideways for a bigger island!': '↻ 横过来玩，小岛更大！',
    'LOADING…': '加载中…',
    // HUD and touch
    'HI-SCORE': '最高分', WATER: '水位', 'The 7 gems of this island': '这座小岛的 7 颗宝石',
    'HIGH FIVE': '击掌', 'HIGH 5': '击掌', '✋ HIGH FIVE': '✋ 击掌', JUMP: '跳', RAINBOW: '彩虹', CALL: '叫人',
    'Pause (P)': '暂停 (P)', Pause: '暂停', 'Sound (M)': '声音 (M)', 'Sound on or off': '声音 开或关', 'Sound on / off (M)': '声音 开 / 关 (M)',
    'Walk left': '往左走', 'Walk right': '往右走',
    // big words and pops
    'CRACK!': '咔嚓！', 'BONK!': '咚！', 'BOINK!': '嘣！', 'OOPS!': '哎呀！', 'SPLASH!': '扑通！', 'BUBBLE UP!': '泡泡飞起来！', 'SOAKED!': '湿透啦！',
    'NO ROOM!': '没地方啦！', 'GEM! +1,000': '宝石！+1,000', 'RAINBOW BONUS!': '彩虹大奖！', '+10,000 · EXTRA LIFE!': '+10,000 · 多一条命！',
    'HURRY! THE WATER IS RISING!': '快！水涨上来啦！', 'ROUND CLEAR!': '过关啦！', 'ALL ISLANDS CLIMBED!': '所有小岛都爬完啦！',
    'HIGH FIVE! ✋ +50': '击掌！✋ +50', 'GOAL!': '终点！',
    // pause and results
    'P · Esc · Space to go on · Q for the menu · M sound': 'P · Esc · 空格 继续 · Q 回菜单 · M 声音',
    '↻ PLAY AGAIN': '↻ 再玩一次', 'Enter: play again · Esc: menu': '回车：再玩一次 · Esc：菜单',
    'GREAT CLIMBING!': '爬得真棒！', 'TEAM CLIMB!': '兄弟一起爬！',
    '⭐ NEW HI-SCORE!': '⭐ 新纪录！', '⭐ ON THE BOARD!': '⭐ 上榜啦！',
    '🐣 TOP CLIMBERS': '🐣 爬高高手榜', '🔥 TOP CLIMBERS': '🔥 爬高高手榜',
    // the ? panel
    '1 player': '单人', '2 players: Teddy': '双人：Teddy', '2 players: Tommy': '双人：Tommy',
    'throw a rainbow the way you face': '朝你面对的方向扔彩虹',
    'call your brother: a giant rainbow staircase (2 players: high five)': '叫兄弟来：他扔出一座大彩虹楼梯（双人：击掌）',
    'title: 1 or 2 players · easy · normal · climber · island': '标题页：1 或 2 个人 · 简单 · 普通 · 换人 · 选小岛',
    'Throw a rainbow, walk up it, and throw the next one from the top. Rainbows bonk the critters they land on (they turn into fruit). Jump on a rainbow to break it and drop it on the critters below (they drop gems). Collect all 7 gems for a bonus. The water keeps rising, so keep climbing to the treasure at the top! Call your brother as often as you like.':
      '扔出一道彩虹，走上去，再从彩虹顶上扔下一道。彩虹落在小怪物身上就把它变成水果。跳到彩虹上能把它踩碎，砸到下面的小怪物（它们会掉出宝石）。集齐 7 颗宝石有大奖。水一直在涨，快往上爬到顶上的宝箱！兄弟想叫几次就叫几次。',
    "◀ ▶ walk, 🌈 throws a rainbow, ⤴️ jumps (jump on a rainbow to break it), and your brother's face calls him. 2 players: a pad each.": '◀ ▶ 走路，🌈 扔彩虹，⤴️ 跳（跳到彩虹上就能把它踩碎），点兄弟的脸叫他来。双人：每人一组按钮。',
  }));
  Kit.lang.rule(/^(\d) · (.+)$/, (m, n, s) => `${n} · ${I(s)}`);
  Kit.lang.rule(/^(\d) OF (\d) OPEN$/, '已开 $1 / $2 座');
  Kit.lang.rule(/^(\d)-(\d) · (.+)$/, (m, a, b, s) => `${a}-${b} · ${I(s)}`);
  Kit.lang.rule(/^(.+ ISLAND) · ROUND (\d)$/, (m, s, n) => `${I(s)} · 第 ${n} 关`);
  Kit.lang.rule(/^ROUND (\d)$/, '第 $1 关');
  Kit.lang.rule(/^(.+ ISLAND) CLEAR!$/, (m, s) => `${I(s)}爬完啦！`);
  Kit.lang.rule(/^HI-SCORE ([\d,]+) · (\w+)$/, '最高分 $1 · $2');
  Kit.lang.rule(/^CALL (\w+)$/, '叫 $1');
  Kit.lang.rule(/^BONK ×(\d+)!$/, '咚 ×$1！');
  Kit.lang.rule(/^🌊 ([\d.]+) m$/, '🌊 $1 米');
  Kit.lang.rule(/^(\w+) SAYS: CLIMB MY RAINBOW STAIRS!$/, '$1 说：爬我的彩虹楼梯！');
  Kit.lang.rule(/^(\w+) ([\d,]+) · (\w+) ([\d,]+)$/, '$1 $2 分 · $3 $4 分');
  Kit.lang.rule(/^([\d,]+) points · island (\d) round (\d)$/, '$1 分 · 第 $2 座小岛第 $3 关');
  Kit.lang.rule(/^([\d,]+) points · all (\d+) rounds!$/, '$1 分 · $2 关全部爬完！');
})();
