const Discord = require('discord.js');
const client = new Discord.Client({disableMentions: 'all'});
const config = require('./config.json');
const cooldowns = new Discord.Collection();
const db = require('./redis.js');
const ms = require('ms');
const { promisify } = require('util');

client.on('ready', async () => {
    const time = new Date();
    console.log(`\t__confessions bot 3.0__\n$ | ${client.user.username} has logged in!\n$ | Login date: ${time}`);
    client.user.setActivity(config.defaultStatus);
});

// main confessions suit
client.on('message', async message => {

    if(message.channel.type === 'dm') {

        // important constants for building the confessions
        const guild = client.guilds.cache.get(config.server);
        const confessionChannel = guild.channels.cache.get(config.confessionChannel);
        const logChannel = guild.channels.cache.get(config.logChannel);
        const guildMember = guild.members.cache.get(message.author.id);
        
        // a user must pass all these checks in order to be able to make a confession
        if(message.author.bot) return;
        if(message.content.length > 1400) return message.reply('Your confession is too long try again with 1400 characters or less');
        if(guildMember.roles.cache.has(config.muteRole)) return message.reply('You cannot make confessions while you are muted!');
        if(message.content.split(/ +/g).length < 2) return message.reply('your confession is too short!');
        if(message.content.match(/nigga|niggers|niggas|nigger|n¡gga/i)) return message.reply('Your confession cannot include racial slurs');
        if(message.content.match(/(https?:\/\/[^\s]+)|discord\.gg\/\w+/i)) return message.reply('your confession cannot contain links');
       
        const getAsync = promisify(db.smembers).bind(db);
        const data = await getAsync('blacklist');
        
        if(data.includes(message.author.id)) return message.reply("You have been blacklisted and can no longer make confessions!");
        //cooldown
        if(!cooldowns.has(message.author.id))
            cooldowns.set(message.author.id, new Discord.Collection());
        const now = Date.now();
        const userCooldown = cooldowns.get(message.author.id);
        const cooldownAmount = 300000; // 5 minutes

        if(cooldowns.has(message.author.id)) {
            const expiration = userCooldown.get(message.author.id) + cooldownAmount;
            if(now < expiration) {
                const timeLeft = expiration - now;
                return message.reply(`You are on cooldown you must wait ${ms(ms(timeLeft.toFixed(1)), {long: true})} to make another confessions`);
            }
        }
        userCooldown.set(message.author.id, now);

        setTimeout(() => userCooldown.delete(message.author.id), cooldownAmount);

        confessionChannel.send(new Discord.MessageEmbed()
        .setTitle('Confession:')
        .setDescription(message.content)
        .setColor('RANDOM')
        .setFooter('to make a confession DM me'));

        message.reply(`Your confession has been sent to ${confessionChannel}. you must wait 5 minutes in between confessions!`);

        logChannel.send(new Discord.MessageEmbed()
        .setAuthor(`${message.author.username}`, message.author.avatarURL())
        .setFooter(`ID: ${message.author.id}`)
        .setDescription(message.content));
    }
});

// command modules
client.on('message', async message => {

    if(message.channel.type === 'text') {

        const prefix = config.prefix;

        if(!message.content.startsWith(prefix) || message.author.bot) return;
        if(!message.member.roles.cache.has(config.staffRole)) 
            return message.reply('this bots commands are only usable by the server staff');

        const argsArray = message.content.slice(prefix.length).split(/ +/g);
        const command = argsArray.shift().toLowerCase();
        const args = argsArray.join(' ').toLowerCase();

        if(command === 'ping') return message.channel.send(Math.floor(client.ws.ping));
        if(command === 'say') {
            message.delete();
            message.channel.send(args);
        }

        if(command === 'blacklist') {

            const guildMember = message.guild.member(message.guild.members.cache.get(argsArray[0]) || message.mentions.users.first());
            if(!guildMember) return message.reply('that is not a valid user!')

            db.exists('blacklist', () => {
                db.sadd(['blacklist', `${guildMember.id}`]);
                return message.reply(`**${guildMember.user.tag}** has been blacklisted!`);
            });

            if(!db.smembers('blacklist')) {
                db.sadd(['blacklist', `${guildMember.id}`]);
                return message.reply(`**${guildMember.user.tag}** has been blacklisted!`);
            }
        }

        if(command === 'whitelist') {

            const guildMember = message.guild.member(message.guild.members.cache.get(argsArray[0]) || message.mentions.users.first());
            if(!guildMember) return message.reply('that is not a valid user!')

            db.exists('blacklist', () => {
                db.srem(['blacklist', `${guildMember.id}`]);
                return message.reply(`**${guildMember.user.tag}** has been whitelisted!`);
            });
            return;
        }

        if(command === 'reset') {
            db.del(['blacklist']);
            return message.reply('blacklist database has been reset!');
        }

        if(command === 'all') {

           db.smembers('blacklist', (err, reply) => {
               const filter = reply.filter(id => client.users.cache.has(id));
               return message.channel.send(new Discord.MessageEmbed()
                .setTitle("All blacklisted members")
                .setColor('RED')
                .setDescription(filter.map(id => {
                    let Member = message.guild.members.cache.get(id);
                    return `❃ - **${!Member ? id : Member.user.tag}**\n`
                })));
           });
        }
    }
});

client.login(config.token);
