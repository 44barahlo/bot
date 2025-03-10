import { open } from 'lmdb'
import { Telegraf } from 'telegraf'

const token = Deno.env.get('BOT_TOKEN')

const bot = new Telegraf(token || '')

const ADMIN_ID = parseInt(Deno.env.get('ADMIN_ID') || '0');

const database = open({
    path: 'database',
    // any options go here, we can turn on compression like this:
    compression: true,
});
/**
 *
 * {
 *  "file_id": <file_id>,
 *  "title": <title>,
 *  "caption": <caption>
 * }
 */
bot.on('inline_query', async (ctx) => {
    const keys = database.getKeys({
        limit: 50
    });
    const voices = []
    for (const val of keys) {
        const voice = database.get(val);
        voices.push({
            type: "voice",
            id: Math.random() * 1000000,
            title: voice.title.length > 0 ? voice.title : 'пусто',
            caption: voice.caption,
            voice_file_id: voice.file_id
        })
    }
    ctx.answerInlineQuery(voices, {
        cache_time: 0
    })
})

bot.on('voice', async (ctx) => {
    // ignore if it is not admin
    if (ctx.from.id != ADMIN_ID)
        return;

    const unique_id = ctx.message.voice.file_id;
    let title = 'Пусто'
    let caption = 'Пусто'
    if (ctx.message.caption) {
        title = ctx.message.caption.split('\n')[0]
        caption = ctx.message.caption.split('\n').slice(1).join('\n')
    }
    database.put(unique_id, {
        file_id: unique_id,
        title: title,
        caption: caption
    })
    ctx.reply('Голосовое сообщение добавлено.', {
        reply_parameters: {
            message_id: ctx.message.message_id
        }
    })
})

bot.command('list', async (ctx) => {
    const keys = database.getKeys();
    
    if (database.getKeysCount() === 0) {
        ctx.reply('Нет сохраненных голосовых сообщений.')
        return;
    }
    
    let message = 'Сохраненные голосовые сообщения:\n\n';
    let counter = 1;
    for (const key of keys) {
        const voice = database.get(key);
        message += `${counter}. ${voice.title}\n`;
        counter++;
    }
    
    ctx.reply(message);
});

bot.command('delete', async (ctx) => {
    // ignore if it is not admin
    if (ctx.from.id != ADMIN_ID)
        return;

    if (ctx.message.reply_to_message && ctx.message.reply_to_message.voice) {
        const file_id = ctx.message.reply_to_message.voice.file_id;
        
        if (database.get(file_id)) {
            database.remove(file_id);
            ctx.reply('Голосовое сообщение удалено.', {
                reply_parameters: {
                    message_id: ctx.message.message_id
                }
            });
        } else {
            ctx.reply('Это голосовое сообщение не найдено в базе данных.', {
                reply_parameters: {
                    message_id: ctx.message.message_id
                }
            });
        }
    } else {
        ctx.reply('Чтобы удалить голосовое сообщение, ответьте на него командой /delete', {
            reply_parameters: {
                message_id: ctx.message.message_id
            }
        });
    }
});

bot.command('help', (ctx) => {
    const helpText = `
Помощь по использованию бота:

1. Отправьте голосовое сообщение, чтобы сохранить его.
2. Добавьте подпись при отправке голосового сообщения:
   - Первая строка будет использована как название
   - Остальные строки будут использованы как описание

3. Чтобы изменить информацию о голосовом сообщении:
   - Ответьте на голосовое сообщение текстом
   - Первая строка будет новым названием
   - Остальные строки будут новым описанием

4. Команды:
   /list - показать список всех сохраненных голосовых сообщений
   /delete - удалить голосовое сообщение (ответьте на голосовое)
   /help - показать эту справку

5. Используйте инлайн-режим (@${ctx.botInfo.username}), чтобы отправить сохраненное голосовое сообщение.
    `;
    
    ctx.reply(helpText);
});



// Handle replies to edit voice message information
bot.on('text', async (ctx) => {
    // ignore if it is not admin
    if (ctx.from.id != ADMIN_ID)
        return;
    
    // Check if the message is a reply to another message
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.voice) {
        const file_id = ctx.message.reply_to_message.voice.file_id;
        const voiceData = database.get(file_id);
        
        // Check if this voice message exists in our database
        if (voiceData) {
            const newText = ctx.message.text;
            const lines = newText.split('\n');
            
            // Update title and caption
            voiceData.title = lines[0] || 'Пусто';
            voiceData.caption = lines.slice(1).join('\n') || 'Пусто';
            
            // Save updated data
            database.put(file_id, voiceData);
            
            ctx.reply('Информация о голосовом сообщении обновлена.', {
                reply_parameters: {
                    message_id: ctx.message.message_id
                }
            });
        } else {
            ctx.reply('Это голосовое сообщение не найдено в базе данных.', {
                reply_parameters: {
                    message_id: ctx.message.message_id
                }
            });
        }
    }
});

// Handle errors
bot.catch((err, ctx) => {
    console.error('Ошибка в боте:', err);
    ctx.reply('Произошла ошибка. Пожалуйста, повторите попытку позже.');
});

bot.launch()

// Enable graceful stop
Deno.addSignalListener('SIGINT', () => bot.stop('SIGINT'));
Deno.addSignalListener('SIGBREAK', () => bot.stop('SIGTERM'));
