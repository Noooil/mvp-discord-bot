const Discord = require('discord.io');
const logger = console;
const token = process.env.TOKEN
const MVP = require('./mvp.json');
// Initialize Discord Bot
const bot = new Discord.Client({
  token: token,
  autorun: true,
  messageCacheLimit: 0
});

bot.on('ready', function (evt) {
  logger.info('Connected');
  logger.info('Logged in as: ');
  logger.info(bot.username + ' - (' + bot.id + ')');

  setInterval(() => {
    for (let key in MVP) {
      if (MVP[key]['death']) {
        let deadForMin = Math.floor((new Date() - new Date(MVP[key]['death'])) / 60000);
        let minRespawnInMin = MVP[key]['min'] - deadForMin;
        let maxRespawnInMin = MVP[key]['max'] - deadForMin;

        // 5 minutes timer
        if (minRespawnInMin == 5) {
          bot.sendMessage({
            to: MVP[key]['channelID'],
            message: `${fancyName(key)} could respawn in 5 minutes!`
          })
        }

        // could have been respawned
        if (maxRespawnInMin != 0 && minRespawnInMin == 0) {
          bot.sendMessage({
            to: MVP[key]['channelID'],
            message: `${fancyName(key)} could be respawned!`
          })
        }

        if (maxRespawnInMin == 0) {
          bot.sendMessage({
            to: MVP[key]['channelID'],
            message: `${fancyName(key)} has been respawned!`
          })
          delete MVP[key]['death']
        }

        if (MVP[key]['msgID']) {
          let msg = (minRespawnInMin == maxRespawnInMin) ? `${fancyName(key)} will respawn in ${minRespawnInMin}!` : `${fancyName(key)} could respawn between ${minRespawnInMin} and ${maxRespawnInMin} minutes!`
          bot.editMessage({
            channelID: MVP[key]['channelID'],
            messageID: MVP[key]['msgID'],
            message: msg
          })
        }

      } else {
        continue
      }
    }
  }, 60000)
});

bot.on('message', function (user, userID, channelID, message, evt) {
  // Our bot needs to know if it will execute a command
  // It will listen for messages that will start with `!`
  if (message.substring(0, 1) == '!') {
    let args = message.substring(1).split(' ');
    let time, time2, death;
    let del = false;
    let msg = '';


    if (user == 'MVP') return

    if (args[0].toLowerCase() == 'list') {
      let sortedList = Object.entries(MVP).filter((key, value) => {
        return key[1]['death']
      })
        .sort((a, b) => {
          let aDeadForMin = Math.floor((new Date() - new Date(a[1]['death'])) / 60000);
          let aMinRespawnInMin = a[1]['min'] - aDeadForMin;
          let bDeadForMin = Math.floor((new Date() - new Date(b[1]['death'])) / 60000);
          let bMinRespawnInMin = b[1]['min'] - bDeadForMin;
          if (aMinRespawnInMin > bMinRespawnInMin) {
            return 1;
          }
          if (aMinRespawnInMin < bMinRespawnInMin) {
            return -1;
          }
          return 0;
        })
      let msg = sortedList.map(mvp => (mvp[1]['min'] - Math.floor((new Date() - new Date(mvp[1]['death'])) / 60000)) + ' min ' + fancyName(mvp[0]) + ' (' + mvp[1]['map'] + ')\n').join('')
      if (sortedList.length == 0) msg = 'No records found'
      bot.sendMessage({
        to: channelID,
        message: msg
      })
      return
    }

    if (args[0].toLowerCase() == 'help') {
      bot.sendMessage({
        to: channelID,
        message: `
        **!mvp_name <+-minutes/timestring XX:XX>** will track the named mvp\n**!mvp_name del** will delete the given record\n**!mvp_name** will return respawn information (last message will be updated every minute)\n**!list** will display a list sorted by earliest respawn\n**!help** will display this help message\n`
      })
      return
    }

    if (!isNaN(args[args.length - 1])) {
      time = args.pop();
    }

    if (/^\d{2}:\d{2}$/.test(args[args.length - 1])) {
      time2 = args.pop()
    }

    if (args[args.length - 1] == 'del') {
      del = true;
      args.pop()
    }

    if (time || time2) {
      death = new Date();
      if (time) {
        death.setTime(death.getTime() + (time * 60000))
      } else {
        let timestring = death.toISOString().split('T')[0] + 'T' + time2
        death = new Date(timestring)
      }
      if (isNaN(death)) {
        bot.sendMessage({
          to: channelID,
          message: `Timestring is invalid\n`
        })
        return
      }
    }

    const mvp = args.join('_').toUpperCase();

    if (typeof MVP[mvp] === 'string') {
      let alias = mvp
      mvp = resolveAlias(MVP[mvp])
      bot.sendMessage({
        to: channelID,
        message: `*${fancyName(alias)}* alias for *${fancyName(mvp)}*\n`
      })
    }

    let candidates = Object.keys(MVP).filter(key => {
      return key.startsWith(mvp)
    })

    if (candidates[0] !== mvp) {
      msg += (candidates.length == 0) ? `Baka, there is no mvp named *${fancyName(mvp)}*` : 'Baka, did you mean?\n'
      candidates.forEach(name => {
        let resolved = resolveAlias(name)
        msg += `${fancyName(name)}${(resolved != name) ? ' (Alias for ' + fancyName(resolved) + ')' : ''} (${MVP[resolved]['map']})\n`
      })
    } else {
      // could identify
      if (del) {
        delete MVP[mvp]['death']
        bot.sendMessage({
          to: channelID,
          message: `${fancyName(mvp)} record deleted\n`
        });
      } else
        if (death) {
          MVP[mvp]['death'] = death.toString()
          MVP[mvp]['channelID'] = channelID
          let deadForMin = Math.floor((new Date() - new Date(MVP[mvp]['death'])) / 60000);
          let minRespawnInMin = MVP[mvp]['min'] - deadForMin;
          bot.sendMessage({
            to: channelID,
            message: `${fancyName(mvp)} was killed at ${death.toLocaleTimeString()} will remind you in ${minRespawnInMin - 5} minutes.\n`
          });
        }
      if (MVP[mvp]['death']) {
        let deadForMin = Math.floor((new Date() - new Date(MVP[mvp]['death'])) / 60000);
        let minRespawnInMin = MVP[mvp]['min'] - deadForMin;
        let maxRespawnInMin = MVP[mvp]['max'] - deadForMin;
        if (minRespawnInMin == maxRespawnInMin) {
          bot.sendMessage({
            to: channelID,
            message: `${fancyName(mvp)} will respawn in ${minRespawnInMin}!`
          }, (error, result) => {
            MVP[mvp]['msgID'] = result.id,
              MVP[mvp]['channelID'] = channelID
          });
        }
        bot.sendMessage({
          to: channelID,
          message: `${fancyName(mvp)} could respawn between ${minRespawnInMin} and ${maxRespawnInMin} minutes!`
        }, (error, result) => {
          MVP[mvp]['msgID'] = result.id,
            MVP[mvp]['channelID'] = channelID
        });
      } else {
        msg += 'No record found\n'
      }

    }

    if (msg) {
      bot.sendMessage({
        to: channelID,
        message: msg
      });
    }
  }
});

function fancyName(name) {
  return name.split('_').map(name => {
    return name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
  }).join(' ')
}

function resolveAlias(mvp) {
  if (typeof MVP[mvp] === 'string') {
    return resolveAlias(MVP[mvp])
  } else {
    return mvp
  }
}
