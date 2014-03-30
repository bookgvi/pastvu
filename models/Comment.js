'use strict';

var mongoose = require('mongoose'),
	Schema = mongoose.Schema;

var delInfo = {
		user: {type: Schema.Types.ObjectId, ref: 'User'},
		stamp: {type: Date},
		reason: {
			key: {type: Number}, //Номер причины удаления из справочника
			desc: {type: String} //Ручное описание причины удаления. Как основное, так и дополнительное в случае key
		},
		origin: {type: Number}, //Если у удаляемого комментария есть дочерние, проставляем им ссылку (cid) непосредственно удаляемого, в этом случае reason дочерним можно не указывать
		role: {type: Number}, //Реализуемая на момент удаления роль пользователя. Например, если это модератор. При удалении своего комментария без потомков не заполняется
		roleregion: {type: Number} //Регион реализуемой роли
	},
	histScheme = {
		user: {type: Schema.Types.ObjectId, ref: 'User'},
		stamp: {type: Date, 'default': Date.now, required: true},
		frag: {type: Number},
		txt: {type: String},
		txtdiff: {type: String},
		del: { //Некоторые поля удаления из delInfo (остальные непосредственно в histScheme)
			reason: {
				key: {type: Number},
				desc: {type: String}
			},
			origin: {type: Number}
		},
		restore: {type: Boolean}, //Восстановлен
		role: {type: Number}, //Реализуемая на момент операции роль пользователя. Например, если это модератор
		roleregion: {type: Number} //Регион реализуемой роли
	},
	CommentPSchema = new Schema(
		{
			cid: {type: Number, index: {unique: true}},
			obj: {type: Schema.Types.ObjectId, ref: 'Photo', index: true},
			user: {type: Schema.Types.ObjectId, ref: 'User', index: true},
			stamp: {type: Date, 'default': Date.now, required: true, index: true},
			txt: {type: String},
			parent: {type: Number},
			level: {type: Number},
			frag: {type: Boolean},

			lastChanged: {type: Date}, //Время последнего изменения
			hist: [new Schema(histScheme)],

			del: delInfo, //Удалённый
			hidden: {type: Boolean} //Скрытый комментарий, например, у неактивной фотографии. Не отображается в списке пользователя и не участвует в статистике
		},
		{
			strict: true
		}
	),
//Комментарии новостей
	CommentNSchema = new Schema(
		{
			cid: {type: Number, index: {unique: true}},
			obj: {type: Schema.Types.ObjectId, ref: 'News', index: true},
			user: {type: Schema.Types.ObjectId, ref: 'User', index: true},
			stamp: {type: Date, 'default': Date.now, required: true, index: true},
			txt: {type: String},
			parent: {type: Number},
			level: {type: Number},

			lastChanged: {type: Date}, //Время последнего изменения
			hist: [new Schema(histScheme)],

			del: delInfo //Удалённый
		},
		{
			strict: true,
			collection: 'commentsn'
		}
	);

CommentPSchema.index({ user: 1, stamp: -1 }); // Составной индекс для запроса комментариев фотографий пользователя
//CommentSchema.index({ photo: 1, stamp: 1 }); // Составной индекс для запроса комментариев фотографии. (Пока не нужен)

module.exports.makeModel = function (db) {
	db.model('Comment', CommentPSchema);
	db.model('CommentN', CommentNSchema);
};
