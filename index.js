const {
  Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ChannelSelectMenuBuilder, RoleSelectMenuBuilder,
  ChannelType, PermissionsBitField
} = require('discord.js');
const { createTranscript } = require('discord-html-transcripts');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

// تحميل الاعدادات من الملف
let CONFIG = {};
if (fs.existsSync('./config.json')) {
  CONFIG = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
}

function saveConfig() {
  fs.writeFileSync('./config.json', JSON.stringify(CONFIG, null, 2));
}

client.once('ready', async () => {
  console.log(`✅ ${client.user.tag} شغال`);

  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (guild) {
    await guild.commands.create({
      name: 'setup-ticket',
      description: 'اعداد نظام التذاكر من السيرفر',
      defaultMemberPermissions: PermissionsBitField.Flags.Administrator
    });
  }
});

// امر الاعداد
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'setup-ticket') {
    const row1 = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
       .setCustomId('select_category')
       .setPlaceholder('1. اختر كاتيقوري التذاكر')
       .setChannelTypes([ChannelType.GuildCategory])
    );

    const row2 = new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder()
       .setCustomId('select_staff')
       .setPlaceholder('2. اختر رتب الادارة - تقدر تختار 3')
       .setMaxValues(3)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
       .setCustomId('select_log')
       .setPlaceholder('3. اختر روم اللوج للترانسكربت')
       .setChannelTypes([ChannelType.GuildText])
    );

    await interaction.reply({
      content: '**اعداد نظام التذاكر**\nاختر من القوائم بالترتيب:',
      components: [row1, row2, row3],
      ephemeral: true
    });
  }
});

// حفظ الاختيارات
client.on('interactionCreate', async interaction => {
  if (interaction.isChannelSelectMenu() && interaction.customId === 'select_category') {
    CONFIG.TICKET_CATEGORY = interaction.values[0];
    saveConfig();
    await interaction.reply({ content: '✅ تم حفظ كاتيقوري التذاكر', ephemeral: true });
  }

  if (interaction.isRoleSelectMenu() && interaction.customId === 'select_staff') {
    CONFIG.STAFF_ROLES = interaction.values;
    saveConfig();
    await interaction.reply({ content: `✅ تم حفظ ${interaction.values.length} رتبة ادارة`, ephemeral: true });
  }

  if (interaction.isChannelSelectMenu() && interaction.customId === 'select_log') {
    CONFIG.LOG_CHANNEL = interaction.values[0];
    saveConfig();
    await interaction.reply({ content: '✅ تم حفظ روم اللوج\nالحين تقدر تنشر البانل بامر /publish-ticket', ephemeral: true });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'publish-ticket') {
    if (!CONFIG.TICKET_CATEGORY ||!CONFIG.STAFF_ROLES) {
      return interaction.reply({ content: 'اول شي سوي /setup-ticket واختار الاعدادات', ephemeral: true });
    }

    const embed = new EmbedBuilder()
     .setTitle('🎫 نظام التذاكر')
     .setDescription('**اختر نوع التذكرة المناسبة لك من القائمة بالاسفل**\n\n> الدعم الفني • الشكاوى • الشراء • الاستفسار')
     .setColor(0x2B2D31)
     .setFooter({ text: 'سيتم انشاء روم خاص لك خلال ثواني' })
     .setThumbnail(interaction.guild.iconURL());

    const menu = new StringSelectMenuBuilder()
     .setCustomId('ticket_type')
     .setPlaceholder('اختر نوع التذكرة')
     .addOptions([
        { label: 'الدعم الفني', description: 'مشكلة تقنية او خطأ', emoji: '🛠️', value: 'support' },
        { label: 'شكوى', description: 'تقديم شكوى على عضو او ادارة', emoji: '📝', value: 'complaint' },
        { label: 'شراء', description: 'الاستفسار عن المنتجات والاسعار', emoji: '💰', value: 'buy' },
        { label: 'استفسار عام', description: 'سؤال او استفسار', emoji: '❓', value: 'general' }
      ]);

    const row = new ActionRowBuilder().addComponents(menu);
    await interaction.reply({ embeds: [embed], components: [row] });
  }
});

// انشاء التذكرة
client.on('interactionCreate', async interaction => {
  if (!interaction.isStringSelectMenu() || interaction.customId!== 'ticket_type') return;

  const type = interaction.values[0];
  const user = interaction.user;
  const guild = interaction.guild;

  const typeNames = {
    support: 'دعم-فني',
    complaint: 'شكوى',
    buy: 'شراء',
    general: 'استفسار'
  };

  const staffPermissions = CONFIG.STAFF_ROLES.map(roleId => ({
    id: roleId,
    allow: [
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.ManageChannels,
      PermissionsBitField.Flags.AttachFiles
    ]
  }));

  const ticketChannel = await guild.channels.create({
    name: `${typeNames[type]}-${user.username}`,
    type: ChannelType.GuildText,
    parent: CONFIG.TICKET_CATEGORY,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles] },
     ...staffPermissions
    ]
  });

  const embed = new EmbedBuilder()
   .setTitle(`🎫 تذكرة ${typeNames[type]}`)
   .setDescription(`مرحباً ${user}!\nاشرح مشكلتك بالتفصيل وسنقوم بمساعدتك قريباً.\n\n**نوع التذكرة:** ${type}`)
   .setColor(0x5865F2)
   .setTimestamp();

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('claim').setLabel('استلام التذكرة').setStyle(ButtonStyle.Success).setEmoji('👋'),
    new ButtonBuilder().setCustomId('close').setLabel('اغلاق').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
    new ButtonBuilder().setCustomId('delete').setLabel('حذف').setStyle(ButtonStyle.Secondary).setEmoji('🗑️'),
    new ButtonBuilder().setCustomId('transcript').setLabel('حفظ المحادثة').setStyle(ButtonStyle.Primary).setEmoji('📄')
  );

  await ticketChannel.send({
    content: `${user} ${CONFIG.STAFF_ROLES.map(r => `<@&${r}>`).join(' ')}`,
    embeds: [embed],
    components: [buttons]
  });
  await interaction.reply({ content: `تم انشاء تذكرتك: ${ticketChannel}`, ephemeral: true });
});

// ازرار التحكم
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;
  const channel = interaction.channel;

  if (interaction.customId === 'claim') {
    await channel.setName(`claimed-${channel.name}`);
    await interaction.reply({ content: `✅ تم استلام التذكرة بواسطة ${interaction.user}` });
  }

  if (interaction.customId === 'close') {
    const confirm = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm_close').setLabel('تأكيد الاغلاق').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('cancel_close').setLabel('الغاء').setStyle(ButtonStyle.Secondary)
    );
    await interaction.reply({ content: 'هل انت متأكد تبي تقفل التذكرة؟', components: [confirm], ephemeral: true });
  }

  if (interaction.customId === 'confirm_close') {
    await channel.permissionOverwrites.set([
      { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] }
    ]);
    await interaction.update({ content: '🔒 تم قفل التذكرة', components: [] });
  }

  if (interaction.customId === 'cancel_close') {
    await interaction.update({ content: 'تم الغاء الاغلاق', components: [] });
  }

  if (interaction.customId === 'delete') {
    await interaction.reply({ content: '🗑️ سيتم حذف التذكرة بعد 5 ثواني...' });
    setTimeout(() => channel.delete().catch(() => {}), 5000);
  }

  if (interaction.customId === 'transcript') {
    await interaction.deferReply();
    const transcript = await createTranscript(channel, {
      limit: -1,
      returnType: 'attachment',
      filename: `transcript-${channel.name}.html`
    });
    const logChannel = client.channels.cache.get(CONFIG.LOG_CHANNEL);
    if (logChannel) {
      await logChannel.send({ content: `📄 ترانسكربت ${channel.name}`, files: [transcript] });
    }
    await interaction.editReply({ content: 'تم حفظ المحادثة وارسالها لروم اللوج' });
  }
});

client.login();
