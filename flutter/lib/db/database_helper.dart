// lib/db/database_helper.dart
//
// SQLite wrapper that mirrors the TypeScript/Dexie club schema.
// Depends on: sqflite, path  (both listed in pubspec.yaml)

import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart' as p;

import '../models/golf_club.dart';

class DatabaseHelper {
  DatabaseHelper._();
  static final DatabaseHelper instance = DatabaseHelper._();

  static const _dbName = 'my_golf_bag.db';
  static const _dbVersion = 1;
  static const _tableName = 'clubs';

  Database? _db;

  Future<Database> get database async {
    _db ??= await _initDb();
    return _db!;
  }

  Future<Database> _initDb() async {
    final dbPath = await getDatabasesPath();
    final fullPath = p.join(dbPath, _dbName);

    return openDatabase(
      fullPath,
      version: _dbVersion,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE $_tableName (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            clubType    TEXT    NOT NULL,
            name        TEXT    NOT NULL,
            loftAngle   REAL    NOT NULL DEFAULT 0,
            length      REAL    NOT NULL DEFAULT 0,
            weight      REAL    NOT NULL DEFAULT 0,
            swingWeight TEXT    NOT NULL DEFAULT '',
            lieAngle    REAL    NOT NULL DEFAULT 0,
            shaftType   TEXT    NOT NULL DEFAULT '',
            torque      REAL    NOT NULL DEFAULT 0,
            flex        TEXT    NOT NULL DEFAULT 'R',
            distance    REAL    NOT NULL DEFAULT 0,
            notes       TEXT    NOT NULL DEFAULT '',
            createdAt   TEXT,
            updatedAt   TEXT
          )
        ''');
      },
    );
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  Future<List<GolfClub>> getAllClubs() async {
    final db = await database;
    final maps = await db.query(_tableName, orderBy: 'loftAngle ASC');
    return maps.map(_fromMap).toList();
  }

  Future<int> insertClub(GolfClub club) async {
    final db = await database;
    return db.insert(_tableName, _toMap(club),
        conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<void> updateClub(GolfClub club) async {
    final db = await database;
    await db.update(
      _tableName,
      _toMap(club),
      where: 'id = ?',
      whereArgs: [club.id],
    );
  }

  Future<void> deleteClub(int id) async {
    final db = await database;
    await db.delete(_tableName, where: 'id = ?', whereArgs: [id]);
  }

  Future<void> deleteAllClubs() async {
    final db = await database;
    await db.delete(_tableName);
  }

  Future<void> bulkInsert(List<GolfClub> clubs) async {
    final db = await database;
    final batch = db.batch();
    for (final c in clubs) {
      batch.insert(_tableName, _toMap(c),
          conflictAlgorithm: ConflictAlgorithm.ignore);
    }
    await batch.commit(noResult: true);
  }

  // ── Serialization helpers ─────────────────────────────────────────────────

  static Map<String, dynamic> _toMap(GolfClub c) => {
        if (c.id != 0) 'id': c.id,
        'clubType': c.clubType,
        'name': c.name,
        'loftAngle': c.loftAngle,
        'length': c.length,
        'weight': c.weight,
        'swingWeight': c.swingWeight,
        'lieAngle': c.lieAngle,
        'shaftType': c.shaftType,
        'torque': c.torque,
        'flex': c.flex,
        'distance': c.distance,
        'notes': c.notes,
        'updatedAt': DateTime.now().toIso8601String(),
      };

  static GolfClub _fromMap(Map<String, dynamic> m) => GolfClub(
        id: m['id'] as int,
        clubType: m['clubType'] as String,
        name: m['name'] as String,
        loftAngle: (m['loftAngle'] as num).toDouble(),
        length: (m['length'] as num).toDouble(),
        weight: (m['weight'] as num).toDouble(),
        swingWeight: m['swingWeight'] as String,
        lieAngle: (m['lieAngle'] as num).toDouble(),
        shaftType: m['shaftType'] as String,
        torque: (m['torque'] as num).toDouble(),
        flex: m['flex'] as String,
        distance: (m['distance'] as num).toDouble(),
        notes: m['notes'] as String,
      );
}
