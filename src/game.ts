import { vec2 } from "gl-matrix"
import tileset_src from "$assets/tileset.sprites.png"
import tiles_sheet from "$assets/tileset.sheet.json"
import enemies_src from "$assets/enemies.sprites.png"
import enemies_sheet from "$assets/enemies.sheet.json"
import hero_src from "$assets/hero.sprites.png"
import hero_sheet from "$assets/hero.sheet.json"
import sword_src from "$assets/sword.svg"
import fireball_src from "$assets/fireball.svg"
import heart_src from "$assets/heart.svg"
import flag_src from "$assets/flag.svg"

type World = {
	clock: number
	state: WorldState
	width: number
	height: number
	tiles: Tile[]
	fog: {
		opacity: number
		enemies: number
		treasures: number
		traps: number
	}[]
	entities: Entity[]
	new_entities: Entity[]
	player: Player | null
	input: {
		up: number
		down: number
		left: number
		right: number
		attack: number
		spell: number
		mouse: vec2
	}
	actions: {
		attack: {
			cooldown: number
			cur: number
		}
		spell: {
			range: number
			cooldown: number
			cur: number
			max_charges: number
			charges: number
		}
	}
	sprites: {
		tiles: {
			image: HTMLImageElement
			sheet: SpriteSheet
		}
		enemies: {
			image: HTMLImageElement
			sheet: SpriteSheet
		}
		hero: {
			image: HTMLImageElement
			sheet: SpriteSheet
		}
		sword: HTMLImageElement
		fireball: HTMLImageElement
		heart: HTMLImageElement
		flag: HTMLImageElement
	}
}

type Entity = Player | Monster | Loot | Treasure | SwordSlash | FireBall | Flag

type Player = {
	type: "player"
	deleted: boolean
	state: PlayerState
	position: vec2
	last_position: vec2
	facing: Direction
	fov: number
	health: number
	wealth: number
	speed: number
	t: number
}

type Monster = {
	type: "monster"
	position: vec2
	deleted: boolean
	health: number
	cooldown: number
	target: vec2 | null
	animation: {
		from: vec2
		t: number
	}
}

type Loot = {
	type: "loot"
	position: vec2
	deleted: boolean
	value: number
}

type Treasure = {
	type: "treasure"
	position: vec2
	deleted: boolean
	value: number
}

type SwordSlash = {
	type: "sword_slash"
	position: vec2
	deleted: boolean
	direction: Direction
	damage: number
	t: number
}

type FireBall = {
	type: "fireball"
	position: vec2
	deleted: boolean
	from: vec2
	damage: number
	t: number
}

type Flag = {
	type: "flag"
	position: vec2
	deleted: boolean
}

type PlayerState = number & { __brand: "PlayerState" }
const PlayerState = {
	Moving: 1 as PlayerState,
	Attacking: 2 as PlayerState,
	Hurting: 3 as PlayerState,
}

type WorldState = number & { __brand: "WorldState" }
const WorldState = {
	Paused: 1 as WorldState,
	Playing: 2 as WorldState,
	Win: 3 as WorldState,
	Lose: 4 as WorldState,
}

type Direction = number & { __brand: "Direction" }
const Direction = {
	Up: 1 as Direction,
	Down: 2 as Direction,
	Left: 3 as Direction,
	Right: 4 as Direction,
}

type Tile = number & { __brand: "Tile" }
let __tile_id = 1 as Tile
const Tile = {
	ANY: -3 as Tile,
	IMPASSABLE: -2 as Tile,
	PASSABLE: -1 as Tile,
	NONE: 0 as Tile,
	Empty: __tile_id++,
	WallTop: __tile_id++,
	WallTopLeft: __tile_id++,
	WallTopRight: __tile_id++,
	WallLeft: __tile_id++,
	WallRight: __tile_id++,
	WallBottom: __tile_id++,
	WallBottomLeft: __tile_id++,
	WallBottomRight: __tile_id++,
	DoorClosed: __tile_id++,
	DoorOpen: __tile_id++,
}
const passable_tiles = [Tile.Empty, Tile.DoorOpen]

const TAU = 2 * Math.PI
const CELL_SIZE = 16
const PLAYER_MOVE_DURATION = 0.2
const PLAYER_HURT_DURATION = 0.5

export function create_world(): World {
	const width = 21
	const height = 21
	const world: World = {
		clock: 0,
		state: WorldState.Playing,
		width,
		height,
		tiles: Array.from({ length: width * height }, () => Tile.NONE),
		fog: Array.from({ length: width * height }, () => ({
			opacity: 1,
			enemies: 0,
			traps: 0,
			treasures: 0,
		})),
		entities: [],
		new_entities: [],
		player: null,
		input: {
			up: 0,
			down: 0,
			left: 0,
			right: 0,
			attack: 0,
			spell: 0,
			mouse: vec2.create(),
		},
		actions: {
			attack: {
				cooldown: 1.3,
				cur: 0,
			},
			spell: {
				range: 5,
				cooldown: 3,
				cur: 0,
				max_charges: 3,
				charges: 0,
			},
		},
		sprites: {
			tiles: { image: new Image(), sheet: tiles_sheet },
			enemies: {
				image: new Image(),
				sheet: enemies_sheet,
			},
			hero: {
				image: new Image(),
				sheet: hero_sheet,
			},
			sword: new Image(),
			fireball: new Image(),
			heart: new Image(),
			flag: new Image(),
		},
	}
	world.sprites.tiles.image.src = tileset_src
	world.sprites.enemies.image.src = enemies_src
	world.sprites.hero.image.src = hero_src
	world.sprites.sword.src = sword_src
	world.sprites.fireball.src = fireball_src
	world.sprites.heart.src = heart_src
	world.sprites.flag.src = flag_src

	world.player = {
		type: "player",
		deleted: false,
		state: PlayerState.Moving,
		position: vec2.fromValues(Math.floor(width / 2), Math.floor(height / 2)),
		last_position: vec2.create(),
		facing: Direction.Down,
		fov: 2.5,
		health: 5,
		wealth: 0,
		speed: 4,
		t: 0,
	}
	world.entities.push(world.player)

	for (let n = 0; n < 10; n++) {
		const x = Math.floor(Math.random() * (width - 2)) + 1
		const y = Math.floor(Math.random() * (width - 2)) + 1
		if (world.entities.some(entity => entity.position[0] == x && entity.position[1] == y)) continue
		if (Math.random() < 0.5) {
			world.entities.push({
				type: "monster",
				position: vec2.fromValues(x, y),
				deleted: false,
				health: 3,
				cooldown: 1,
				target: null,
				animation: { from: vec2.create(), t: 1 },
			})
		} else {
			world.entities.push({ type: "treasure", position: vec2.fromValues(x, y), deleted: false, value: 3 })
		}
	}

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (x == 0) {
				if (y == 0) set_at_xy(world.tiles, x, y, width, Tile.WallTopLeft)
				else if (y == height - 1) set_at_xy(world.tiles, x, y, width, Tile.WallBottomLeft)
				else set_at_xy(world.tiles, x, y, width, Tile.WallLeft)
			} else if (x == width - 1) {
				if (y == 0) set_at_xy(world.tiles, x, y, width, Tile.WallTopRight)
				else if (y == height - 1) set_at_xy(world.tiles, x, y, width, Tile.WallBottomRight)
				else set_at_xy(world.tiles, x, y, width, Tile.WallRight)
			} else if (y == 0) set_at_xy(world.tiles, x, y, width, Tile.WallTop)
			else if (y == height - 1) set_at_xy(world.tiles, x, y, width, Tile.WallBottom)
			else set_at_xy(world.tiles, x, y, width, Tile.Empty)
		}
	}

	recompute_fog(world)
	return world
}

export function pause_world(world: World): void {
	if (world.state == WorldState.Playing) world.state = WorldState.Paused
}

export function unpause_world(world: World): void {
	if (world.state == WorldState.Paused) world.state = WorldState.Playing
}

export function draw_world(world: World, ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
	const temp = vec2.create()
	const { width, height } = ctx.canvas

	ctx.reset()
	ctx.imageSmoothingEnabled = false

	ctx.save()
	ctx.translate(
		Math.round(width / 2 - (world.width * CELL_SIZE) / 2),
		Math.round(height / 2 - (world.height * CELL_SIZE) / 2),
	)

	ctx.save()
	for (let i = 0; i < world.tiles.length; i++) {
		const tile = world.tiles[i]
		if (tile == Tile.NONE) continue

		const x = i % world.width
		const y = Math.floor(i / world.width)
		const pos = vec2.set(temp, x, y)

		switch (tile) {
			case Tile.Empty:
				draw_sprite(ctx, world, "tiles", "floor1", pos)
				break
			case Tile.WallTop:
				draw_sprite(ctx, world, "tiles", "wall_top1", pos)
				break
			case Tile.WallTopLeft:
				draw_sprite(ctx, world, "tiles", "wall_topleft1", pos)
				break
			case Tile.WallTopRight:
				draw_sprite(ctx, world, "tiles", "wall_topright1", pos)
				break
			case Tile.WallBottom:
				draw_sprite(ctx, world, "tiles", "wall_bottom1", pos)
				break
			case Tile.WallBottomLeft:
				draw_sprite(ctx, world, "tiles", "wall_bottomleft1", pos)
				break
			case Tile.WallBottomRight:
				draw_sprite(ctx, world, "tiles", "wall_bottomright1", pos)
				break
			case Tile.WallLeft:
				draw_sprite(ctx, world, "tiles", "wall_left1", pos)
				break
			case Tile.WallRight:
				draw_sprite(ctx, world, "tiles", "wall_right1", pos)
				break
			case Tile.DoorClosed:
				draw_sprite(ctx, world, "tiles", "floor1", pos)
				draw_sprite(ctx, world, "tiles", "door_horiz1", pos)
				break
			case Tile.DoorOpen:
				draw_sprite(ctx, world, "tiles", "floor1", pos)
				draw_sprite(ctx, world, "tiles", "door_horiz2", pos)
				break
		}
	}
	ctx.restore()

	for (let i = 0; i < world.fog.length; i++) {
		const fog = world.fog[i]
		const x = i % world.width
		const y = Math.floor(i / world.width)

		ctx.save()
		ctx.translate(x * CELL_SIZE, y * CELL_SIZE)
		if (fog.opacity != 1) {
			let i = 0
			const num_objects = fog.enemies + fog.traps + fog.treasures
			const positions = setups[num_objects]
			ctx.beginPath()
			for (let n = 0; n < fog.enemies; n++) {
				const [x, y] = positions[i++]
				ctx.fillStyle = "firebrick"
				ctx.arc(x * CELL_SIZE, y * CELL_SIZE, 0.13 * CELL_SIZE, 0, TAU)
			}
			ctx.fill()
			ctx.beginPath()
			for (let n = 0; n < fog.traps; n++) {
				const [x, y] = positions[i++]
				ctx.fillStyle = "orange"
				ctx.arc(x * CELL_SIZE, y * CELL_SIZE, 0.13 * CELL_SIZE, 0, TAU)
			}
			ctx.fill()
			ctx.beginPath()
			for (let n = 0; n < fog.treasures; n++) {
				const [x, y] = positions[i++]
				ctx.fillStyle = "lightgreen"
				ctx.arc(x * CELL_SIZE, y * CELL_SIZE, 0.13 * CELL_SIZE, 0, TAU)
			}
			ctx.fill()
		}
		if (fog.opacity != 0) fill_rect(ctx, 0, 0, CELL_SIZE, CELL_SIZE, "gray", fog.opacity)
		ctx.restore()
	}

	for (const entity of world.entities) {
		const fog = get_at_vec2(world.fog, entity.position, world.width)
		const pos = vec2.copy(temp, entity.position)

		ctx.save()
		switch (entity.type) {
			case "player": {
				const player = entity

				let player_sprite_pos = player.position
				if (player.state == PlayerState.Moving)
					player_sprite_pos = vec2.lerp(
						vec2.create(),
						player.last_position,
						player.position,
						1 - player.t / PLAYER_MOVE_DURATION,
					)

				const animation_frame = Math.floor(world.clock / 0.3) % 2
				const is_hurting = player.state == PlayerState.Hurting
				let sprite: TileNames["hero"] = "hero_down1"
				switch (player.facing) {
					case Direction.Up:
						if (is_hurting) sprite = "hero_down3"
						else sprite = animation_frame == 0 ? "hero_up1" : "hero_up2"
						break
					case Direction.Down:
						if (is_hurting) sprite = "hero_down3"
						else sprite = animation_frame == 0 ? "hero_down1" : "hero_down2"
						break
					case Direction.Left:
						if (is_hurting) sprite = "hero_left3"
						else sprite = animation_frame == 0 ? "hero_left1" : "hero_left2"
						break
					case Direction.Right:
						if (is_hurting) sprite = "hero_right3"
						else sprite = animation_frame == 0 ? "hero_right1" : "hero_right2"
						break
				}
				draw_sprite(ctx, world, "hero", sprite, player_sprite_pos)

				if (world.input.spell) {
					ctx.strokeStyle = "white"
					ctx.beginPath()
					ctx.arc(
						(player.position[0] + 0.5) * CELL_SIZE,
						(player.position[1] + 0.5) * CELL_SIZE,
						world.actions.spell.range * CELL_SIZE,
						0,
						TAU,
					)
					ctx.stroke()
				}

				for (let i = 0; i < player.health; i++) {
					ctx.drawImage(world.sprites.heart, i * CELL_SIZE, -1.5 * CELL_SIZE, CELL_SIZE, CELL_SIZE)
				}
				ctx.fillStyle = "white"
				ctx.font = CELL_SIZE + "px monospace"
				ctx.textAlign = "right"
				ctx.textBaseline = "bottom"
				ctx.fillText(player.wealth.toString(), (world.width - 1.25) * CELL_SIZE, -0.25 * CELL_SIZE)
				draw_sprite(ctx, world, "tiles", "gold1", [world.width - 1, -1.25], 1)

				break
			}
			case "monster": {
				if (fog.opacity == 1) break
				const monster = entity
				const montser_sprite_pos = vec2.lerp(
					vec2.create(),
					monster.animation.from,
					monster.position,
					monster.animation.t,
				)
				draw_sprite(ctx, world, "enemies", "ghost_right1", montser_sprite_pos)
				fill_rect(
					ctx,
					(montser_sprite_pos[0] + 0.1) * CELL_SIZE,
					(montser_sprite_pos[1] + 0.8) * CELL_SIZE,
					0.9 * CELL_SIZE,
					0.15 * CELL_SIZE,
					"black",
				)
				fill_rect(
					ctx,
					(montser_sprite_pos[0] + 0.1) * CELL_SIZE,
					(montser_sprite_pos[1] + 0.8) * CELL_SIZE,
					0.9 * (monster.health / 3) * CELL_SIZE,
					0.15 * CELL_SIZE,
					"red",
				)
				if (monster.target) {
					fill_rect(
						ctx,
						monster.target[0] * CELL_SIZE,
						monster.target[1] * CELL_SIZE,
						CELL_SIZE,
						CELL_SIZE,
						"red",
						0.5,
					)
				}
				break
			}
			case "sword_slash": {
				fill_rect(
					ctx,
					entity.position[0] * CELL_SIZE,
					entity.position[1] * CELL_SIZE,
					CELL_SIZE,
					CELL_SIZE,
					"skyblue",
					0.5,
				)
				const delta = direction_to_vec2(vec2.create(), entity.direction)
				fill_rect(
					ctx,
					(entity.position[0] + delta[0]) * CELL_SIZE,
					(entity.position[1] + delta[1]) * CELL_SIZE,
					CELL_SIZE,
					CELL_SIZE,
					"skyblue",
					0.5,
				)
				break
			}
			case "fireball": {
				const pos = vec2.clone(entity.position)
				fill_rect(ctx, pos[0] * CELL_SIZE, pos[1] * CELL_SIZE, CELL_SIZE, CELL_SIZE, "skyblue", 0.5)

				const max_t = vec2.distance(entity.from, entity.position) / 20
				vec2.lerp(pos, entity.from, entity.position, (max_t - entity.t) / max_t)
				ctx.fillStyle = "red"
				ctx.beginPath()
				ctx.arc((pos[0] + 0.5) * CELL_SIZE, (pos[1] + 0.5) * CELL_SIZE, CELL_SIZE / 3, 0, TAU)
				ctx.fill()
				break
			}
			case "loot":
				if (fog.opacity == 1) break
				draw_sprite(ctx, world, "tiles", "gold1", pos)
				break
			case "treasure":
				if (fog.opacity == 1) break
				if (entity.value == 0) draw_sprite(ctx, world, "tiles", "chest3", pos)
				else draw_sprite(ctx, world, "tiles", "chest2", pos)
				break
			case "flag":
				ctx.drawImage(
					world.sprites.flag,
					entity.position[0] * CELL_SIZE,
					entity.position[1] * CELL_SIZE,
					CELL_SIZE,
					CELL_SIZE,
				)
				break
		}
		ctx.restore()
	}

	ctx.restore()

	if (world.player) {
		ctx.save()
		const attack_t = world.actions.attack.cur / world.actions.attack.cooldown
		ctx.lineWidth = 2
		ctx.strokeStyle = attack_t == 0 ? "blue" : "gray"
		ctx.translate(Math.floor(width / 2 - 3.5 * CELL_SIZE), Math.floor(height - 4 * CELL_SIZE))
		ctx.strokeRect(-1, -1, 3 * CELL_SIZE + 2, 3 * CELL_SIZE + 2)
		fill_rect(ctx, 0, 0, 3 * CELL_SIZE, 3 * CELL_SIZE, "white")
		ctx.drawImage(world.sprites.sword, 0, 0, 3 * CELL_SIZE, 3 * CELL_SIZE)
		fill_rect(
			ctx,
			0,
			3 * CELL_SIZE * (1 - attack_t),
			3 * CELL_SIZE,
			Math.ceil(3 * CELL_SIZE * attack_t),
			"gray",
			0.5,
		)
		ctx.restore()

		ctx.save()
		const spell_t = world.actions.spell.cur / world.actions.spell.cooldown
		ctx.lineWidth = 2
		ctx.strokeStyle = world.actions.spell.charges > 0 ? "firebrick" : "gray"
		ctx.translate(Math.floor(width / 2 + 0.5 * CELL_SIZE), Math.floor(height - 4 * CELL_SIZE))
		ctx.strokeRect(-1, -1, 3 * CELL_SIZE + 2, 3 * CELL_SIZE + 2)
		fill_rect(ctx, 0, 0, 3 * CELL_SIZE, 3 * CELL_SIZE, "white")
		ctx.drawImage(world.sprites.fireball, 0, 0, 3 * CELL_SIZE, 3 * CELL_SIZE)
		fill_rect(ctx, 0, 3 * CELL_SIZE * (1 - spell_t), 3 * CELL_SIZE, Math.ceil(3 * CELL_SIZE * spell_t), "gray", 0.5)
		ctx.textAlign = "center"
		ctx.textBaseline = "middle"
		ctx.font = `bold ${Math.floor(2.5 * CELL_SIZE)}px monospace`
		ctx.fillStyle = "white"
		ctx.strokeStyle = "black"
		ctx.fillText(world.actions.spell.charges.toString(), 1.5 * CELL_SIZE, 1.5 * CELL_SIZE)
		ctx.strokeText(world.actions.spell.charges.toString(), 1.5 * CELL_SIZE, 1.5 * CELL_SIZE)
		ctx.restore()
	}

	switch (world.state) {
		case WorldState.Lose:
			fill_rect(ctx, 0, height / 2 - 2 * CELL_SIZE, width, 4 * CELL_SIZE, "black", 0.7)
			ctx.fillStyle = "red"
			ctx.font = 3 * CELL_SIZE + "px monospace"
			ctx.textAlign = "center"
			ctx.textBaseline = "middle"
			ctx.fillText("Game over", width / 2, height / 2)
			break
		case WorldState.Win:
			fill_rect(ctx, 0, height / 2 - 2 * CELL_SIZE, width, 4 * CELL_SIZE, "black", 0.7)
			ctx.fillStyle = "green"
			ctx.font = 3 * CELL_SIZE + "px monospace"
			ctx.textAlign = "center"
			ctx.textBaseline = "middle"
			ctx.fillText("Game won!", width / 2, height / 2)
			break
	}
}

export function update_world(world: World, delta: number) {
	if (world.state != WorldState.Playing) return

	world.clock += delta
	world.actions.attack.cur = Math.max(world.actions.attack.cur - delta, 0)
	world.actions.spell.cur = Math.max(world.actions.spell.cur - delta, 0)
	if (world.actions.spell.cur == 0 && world.actions.spell.charges < world.actions.spell.max_charges) {
		world.actions.spell.charges++
		if (world.actions.spell.charges < world.actions.spell.max_charges)
			world.actions.spell.cur = world.actions.spell.cooldown
	}

	for (const entity of world.entities) {
		if (entity.deleted) continue
		switch (entity.type) {
			case "player": {
				update_player(world, entity, delta)
				break
			}
			case "monster": {
				const monster = entity
				const fog = get_at_vec2(world.fog, monster.position, world.width)
				if (fog.opacity == 1) break

				if (monster.cooldown == 0) {
					if (monster.target) {
						const targets = get_entities(world, monster.target, ["monster", "player", "treasure"]).toArray()
						if (targets.length == 0) {
							vec2.copy(monster.animation.from, monster.position)
							vec2.copy(monster.position, monster.target)
							monster.animation.t = 0
						}

						const player = targets.find(entity => entity.type == "player")
						if (player) {
							player.health--
							player.state = PlayerState.Hurting
							player.t = PLAYER_HURT_DURATION
						}

						monster.cooldown = 0.5
						monster.target = null
					} else {
						if (!world.player) break
						const delta = vec2.sub(vec2.create(), world.player.position, monster.position)
						if (Math.abs(delta[0]) > Math.abs(delta[1])) delta[1] = 0
						else delta[0] = 0
						vec2.normalize(delta, delta)

						monster.target = vec2.add(delta, monster.position, delta)
						monster.cooldown = 0.7
					}
				}

				monster.cooldown = Math.max(monster.cooldown - delta, 0)
				monster.animation.t = Math.min(monster.animation.t + delta * 5, 1)

				break
			}
			case "sword_slash": {
				entity.t = Math.max(entity.t - delta, 0)
				if (entity.t == 0) {
					const positions = [vec2.create(), direction_to_vec2(vec2.create(), entity.direction)]
					for (const pos of positions) {
						vec2.add(pos, pos, entity.position)
						if (!is_in_bounds_vec2(pos, world.width, world.height)) continue
						const fog = get_at_vec2(world.fog, pos, world.width)
						fog.opacity = 0
						for (const target of get_entities(world, pos, ["monster", "treasure"])) {
							if (target.type == "monster") target.health -= entity.damage
							if (target.type == "treasure" || target.health <= 0) target.deleted = true
						}
					}

					entity.deleted = true
				}
				break
			}
			case "fireball": {
				entity.t = Math.max(entity.t - delta, 0)
				if (entity.t == 0) {
					const fog = get_at_vec2(world.fog, entity.position, world.width)
					fog.opacity = 0
					for (const target of get_entities(world, entity.position, ["monster", "treasure"])) {
						if (target.type == "monster") target.health -= entity.damage
						if (target.type == "treasure" || target.health <= 0) target.deleted = true
					}
					entity.deleted = true
				}
				break
			}
			case "flag": {
				const fog = get_at_vec2(world.fog, entity.position, world.width)
				if (fog.opacity != 1) entity.deleted = true
				break
			}
		}
	}

	for (const fog of world.fog) {
		if (fog.opacity != 0 && fog.opacity != 1) fog.opacity = Math.max(fog.opacity - delta * 5, 0)
	}

	for (const entity of world.entities) {
		if (!entity.deleted) {
			world.new_entities.push(entity)
			continue
		}
		switch (entity.type) {
			case "player":
				world.state = WorldState.Lose
				world.player = null
				break
			case "monster":
				world.new_entities.push({
					type: "loot",
					deleted: false,
					position: entity.position,
					value: Math.floor(Math.random() * 2) + 1,
				})
				break
		}
	}

	world.entities = world.new_entities
	world.new_entities = []
	recompute_fog(world)

	if (world.entities.every(entity => entity.type == "player" || (entity.type == "treasure" && entity.value == 0))) {
		world.state = WorldState.Win
	}
}

function update_player(world: World, player: Player, delta: number) {
	if (player.health <= 0) {
		player.deleted = true
		return
	}

	player.t = Math.max(player.t - delta, 0)
	switch (player.state) {
		case PlayerState.Moving:
			if (player.t != 0) break

			if (world.input.attack && world.actions.attack.cur == 0) {
				let has_flags = false
				for (const flag of get_entities(world, null, ["flag"])) {
					has_flags = true
					flag.deleted = true
					world.new_entities.push({
						type: "fireball",
						position: flag.position,
						deleted: false,
						damage: 2,
						from: vec2.clone(player.position),
						t: vec2.distance(flag.position, player.position) / 20,
					})
				}
				if (has_flags) {
					world.actions.attack.cur = world.actions.attack.cooldown
					player.state = PlayerState.Attacking
					player.t = PLAYER_MOVE_DURATION
					break
				}

				const position = direction_to_vec2(vec2.create(), player.facing)
				vec2.add(position, position, player.position)
				world.new_entities.push({
					type: "sword_slash",
					position,
					deleted: false,
					direction: player.facing,
					damage: 1,
					t: 0.2,
				})
				world.actions.attack.cur = world.actions.attack.cooldown
				player.state = PlayerState.Attacking
				player.t = PLAYER_MOVE_DURATION
				break
			}

			if (world.input.spell && world.actions.spell.charges > 0) {
				const mouse_pos = vec2.clone(world.input.mouse)
				if (!is_in_bounds_vec2(mouse_pos, world.width, world.height)) break
				const player_center = vec2.add(vec2.create(), player.position, [0.5, 0.5])
				if (vec2.distance(mouse_pos, player_center) > world.actions.spell.range) break
				const position = vec2.floor(mouse_pos, mouse_pos)
				if (!has_entity(world, position, ["flag"])) {
					world.new_entities.push({
						type: "flag",
						deleted: false,
						position,
					})
					world.actions.spell.charges--
					world.actions.spell.cur = world.actions.spell.cooldown
					player.state = PlayerState.Attacking
					player.t = PLAYER_MOVE_DURATION
					break
				}
			}

			const movement = vec2.fromValues(world.input.right - world.input.left, world.input.down - world.input.up)
			if (Math.abs(movement[0]) > Math.abs(movement[1])) movement[1] = 0
			else movement[0] = 0
			vec2.normalize(movement, movement)

			if (vec2.squaredLength(movement) == 0) {
				const facing_vec = vec2.sub(vec2.create(), world.input.mouse, player.position)
				player.facing = vec2_to_direction(facing_vec)
			} else {
				const new_pos = vec2.add(vec2.create(), player.position, movement)
				const new_fog = get_at_vec2(world.fog, new_pos, world.width)
				const tile = get_at_vec2(world.tiles, new_pos, world.width)

				let can_move = passable_tiles.includes(tile)
				switch (tile) {
					case Tile.DoorClosed:
						set_at_vec2(world.tiles, new_pos, world.width, Tile.DoorOpen)
						player.t = PLAYER_MOVE_DURATION
						break
				}

				if (can_move) {
					for (const entity of get_entities(world, new_pos, null)) {
						switch (entity.type) {
							case "player":
								can_move = false
								break
							case "monster": {
								can_move = false
								player.health--
								player.state = PlayerState.Hurting
								player.t = PLAYER_HURT_DURATION
								new_fog.opacity = 0
								break
							}
							case "loot": {
								player.wealth += entity.value
								entity.deleted = true
								new_fog.opacity = 0
								break
							}
							case "treasure":
								can_move = false
								vec2.copy(player.last_position, player.position)
								player.t = PLAYER_MOVE_DURATION
								if (new_fog.opacity == 1) {
									new_fog.opacity = 0
								} else {
									player.wealth += entity.value
									entity.value = 0
								}
								break
						}
					}
				}

				if (can_move) {
					vec2.copy(player.last_position, player.position)
					vec2.copy(player.position, new_pos)
					player.t = PLAYER_MOVE_DURATION
					player.facing = vec2_to_direction(movement)
				}
			}

			// for each cell in view range
			const temp = vec2.create()
			const fov_floor = Math.floor(player.fov)
			const fov_ceil = Math.ceil(player.fov)
			for (let dx = -fov_floor; dx <= fov_ceil; dx++) {
				for (let dy = -fov_floor; dy <= fov_ceil; dy++) {
					const dist = Math.hypot(dx, dy)
					if (dist > player.fov) continue

					const cur_pos = vec2.set(temp, player.position[0] + dx, player.position[1] + dy)
					if (!is_in_bounds_vec2(cur_pos, world.width, world.height)) continue

					const cur_fog = get_at_vec2(world.fog, cur_pos, world.width)
					if (cur_fog.opacity == 0) continue
					if (dist == 0) {
						cur_fog.opacity = 0
						continue
					}

					// we reveal if at least one 0 neighbour has been revealed
					for (const neighbour_fog of neighbours(world.fog, cur_pos, world.width, world.height)) {
						const objects = neighbour_fog.enemies + neighbour_fog.traps + neighbour_fog.treasures
						if (objects == 0 && neighbour_fog.opacity != 1) {
							cur_fog.opacity -= 0.0001
							break
						}
					}
				}
			}

			break
		case PlayerState.Hurting:
			if (player.t == 0) player.state = PlayerState.Moving
			break
		case PlayerState.Attacking:
			if (player.t == 0) player.state = PlayerState.Moving
			break
	}
}

type InputKey = "up" | "down" | "left" | "right" | "attack" | "spell"
type Input =
	| { type: "keydown"; key: InputKey }
	| { type: "keyup"; key: InputKey }
	| { type: "mousemove"; clientX: number; clientY: number }
export function handle_input(world: World, input: Input) {
	if (input.type == "mousemove") {
		vec2.set(
			world.input.mouse,
			(input.clientX - innerWidth / 2) / (CELL_SIZE * 2) + world.width / 2,
			(input.clientY - innerHeight / 2) / (CELL_SIZE * 2) + world.height / 2,
		)
	} else {
		const value = input.type == "keydown" ? performance.now() : 0
		switch (input.key) {
			case "up":
				world.input.up = value
				break
			case "down":
				world.input.down = value
				break
			case "left":
				world.input.left = value
				break
			case "right":
				world.input.right = value
				break
			case "attack":
				world.input.attack = value
				break
			case "spell":
				world.input.spell = value
				break
		}
	}
}

function recompute_fog(world: World) {
	for (const fog of world.fog) {
		fog.enemies = 0
		fog.traps = 0
		fog.treasures = 0
	}

	for (const entity of world.entities) {
		const cur_fog = get_at_vec2(world.fog, entity.position, world.width)
		if (cur_fog.opacity != 1) continue
		switch (entity.type) {
			case "monster":
				for (const fog of neighbours(world.fog, entity.position, world.width, world.height)) {
					fog.enemies++
				}
				break
			case "treasure":
				for (const fog of neighbours(world.fog, entity.position, world.width, world.height)) {
					fog.treasures++
				}
				break
		}
	}
}

// function reveal(world: World, pos: vec2, full_reveal = false): void {
// 	const fog = get_at_vec2(world.fog, pos, world.width)
// 	fog.opacity = full_reveal ? 0 : 0.9999
// }

function* get_entities<Type extends Entity["type"]>(
	world: World,
	pos: vec2 | null,
	types: Type[] | null,
	include_deleted = false,
): Generator<Extract<Entity, { type: Type }>, void, undefined> {
	const set = new Set<Entity["type"]>(types)
	for (const entity of world.entities) {
		const is_type_match = types?.length ? set.has(entity.type) : true
		const is_pos_match = pos ? vec2.equals(pos, entity.position) : true
		if (is_type_match && is_pos_match && (!entity.deleted || include_deleted)) yield entity as any
	}
}

function has_entity(world: World, pos: vec2 | null, types: Entity["type"][] | null, include_deleted = false): boolean {
	for (const _entity of get_entities(world, pos, types, include_deleted)) {
		return true
	}
	return false
}

// function entities_by_type_first<Type extends Entity["type"]>(
// 	world: World,
// 	type: Type,
// ): Extract<Entity, { type: Type }> | null {
// 	return (world.entities.find(entity => entity.type == type) as any) ?? null
// }

// function* entities_around(
// 	world: World,
// 	pos: vec2,
// 	distance = Math.SQRT2,
// 	include_deleted = false,
// ): Generator<Entity, void, undefined> {
// 	for (const entity of world.entities) {
// 		if (vec2.distance(entity.position, pos) <= distance && (!entity.deleted || include_deleted)) yield entity
// 	}
// }

// function match_tile_pattern(world: World, pattern: Tile[], pos: vec2): boolean {
// 	for (let dy = -1; dy <= 1; dy++) {
// 		for (let dx = -1; dx <= 1; dx++) {
// 			const i = (dy + 1) * 3 + dx + 1
// 			const candidate = pattern[i]
// 			if (candidate == Tile.ANY) continue
// 			const x = pos[0] + dx
// 			const y = pos[1] + dy
// 			const tile = is_in_bounds_xy(x, y, world.width, world.height)
// 				? get_at_xy(world.tiles, x, y, world.width)
// 				: Tile.NONE
// 			switch (candidate) {
// 				case Tile.PASSABLE:
// 					if (!passable_tiles.includes(tile)) return false
// 					break
// 				case Tile.IMPASSABLE:
// 					if (passable_tiles.includes(tile)) return false
// 					break
// 				default:
// 					if (tile != candidate) return false
// 					break
// 			}
// 		}
// 	}
// 	return true
// }

const setups: vec2[][] = [
	[],
	[vec2.fromValues(0.5, 0.5)],
	[vec2.fromValues(0.8, 0.2), vec2.fromValues(0.2, 0.8)],
	[vec2.fromValues(0.8, 0.2), vec2.fromValues(0.2, 0.8), vec2.fromValues(0.5, 0.5)],
	[vec2.fromValues(0.2, 0.2), vec2.fromValues(0.8, 0.2), vec2.fromValues(0.2, 0.8), vec2.fromValues(0.8, 0.8)],
	[
		vec2.fromValues(0.2, 0.2),
		vec2.fromValues(0.8, 0.2),
		vec2.fromValues(0.2, 0.8),
		vec2.fromValues(0.8, 0.8),
		vec2.fromValues(0.5, 0.5),
	],
	[
		vec2.fromValues(0.2, 0.2),
		vec2.fromValues(0.8, 0.2),
		vec2.fromValues(0.2, 0.8),
		vec2.fromValues(0.8, 0.8),
		vec2.fromValues(0.2, 0.5),
		vec2.fromValues(0.8, 0.5),
	],
	[
		vec2.fromValues(0.2, 0.33),
		vec2.fromValues(0.2, 0.66),
		vec2.fromValues(0.5, 0.2),
		vec2.fromValues(0.5, 0.5),
		vec2.fromValues(0.5, 0.8),
		vec2.fromValues(0.8, 0.33),
		vec2.fromValues(0.8, 0.66),
	],
	[
		vec2.fromValues(0.2, 0.2),
		vec2.fromValues(0.8, 0.2),
		vec2.fromValues(0.2, 0.8),
		vec2.fromValues(0.8, 0.8),
		vec2.fromValues(0.2, 0.5),
		vec2.fromValues(0.8, 0.5),
		vec2.fromValues(0.5, 0.33),
		vec2.fromValues(0.5, 0.66),
	],
]

function get_at_vec2<T>(arr: T[], pos: vec2, stride: number): T {
	return arr[pos[1] * stride + pos[0]]
}

function get_at_xy<T>(arr: T[], x: number, y: number, stride: number): T {
	return arr[y * stride + x]
}

function set_at_vec2<T>(arr: T[], pos: vec2, stride: number, value: T): void {
	arr[pos[1] * stride + pos[0]] = value
}

function set_at_xy<T>(arr: T[], x: number, y: number, stride: number, value: T): void {
	arr[y * stride + x] = value
}

function is_in_bounds_vec2(pos: vec2, width: number, height: number): boolean {
	return pos[0] >= 0 && pos[1] >= 0 && pos[0] < width && pos[1] < height
}

function is_in_bounds_xy(x: number, y: number, width: number, height: number): boolean {
	return x >= 0 && y >= 0 && x < width && y < height
}

function* neighbours<T>(arr: T[], pos: vec2, width: number, height: number): Generator<T, void, undefined> {
	for (let dx = -1; dx <= 1; dx++) {
		for (let dy = -1; dy <= 1; dy++) {
			const x = pos[0] + dx
			const y = pos[1] + dy
			if ((dx != 0 || dy != 0) && is_in_bounds_xy(x, y, width, height)) yield get_at_xy(arr, x, y, width)
		}
	}
}

function direction_to_vec2(out: vec2, direction: Direction): vec2 {
	switch (direction) {
		case Direction.Up:
			return vec2.set(out, 0, -1)
		case Direction.Down:
			return vec2.set(out, 0, 1)
		case Direction.Left:
			return vec2.set(out, -1, 0)
		case Direction.Right:
			return vec2.set(out, 1, 0)
		default:
			throw new Error("exhaustive")
	}
}

function vec2_to_direction(vec: vec2): Direction {
	if (Math.abs(vec[0]) >= Math.abs(vec[1])) return vec[0] < 0 ? Direction.Left : Direction.Right
	else return vec[1] < 0 ? Direction.Up : Direction.Down
}

function direction_to_str(direction: Direction): string {
	switch (direction) {
		case Direction.Up:
			return "Up"
		case Direction.Down:
			return "Down"
		case Direction.Left:
			return "Left"
		case Direction.Right:
			return "Right"
		default:
			throw new Error("exhaustive")
	}
}

type Sprite = {
	frame: { x: number; y: number; w: number; h: number }
}

type SpriteSheet = {
	frames: {
		[name: string]: Sprite
	}
}

type TileNames = {
	tiles: keyof (typeof tiles_sheet)["frames"]
	enemies: keyof (typeof enemies_sheet)["frames"]
	hero: keyof (typeof hero_sheet)["frames"]
}

function draw_sprite<Sheet extends keyof TileNames>(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	world: World,
	sheet_name: Sheet,
	sprite_name: TileNames[Sheet],
	pos: vec2,
	scale = 1,
): void {
	const { sheet, image } = world.sprites[sheet_name]
	const sprite = sheet.frames[sprite_name]
	ctx.drawImage(
		image,
		sprite.frame.x,
		sprite.frame.y,
		sprite.frame.w,
		sprite.frame.h,
		Math.floor(pos[0] * CELL_SIZE),
		Math.floor(pos[1] * CELL_SIZE),
		CELL_SIZE * scale,
		CELL_SIZE * scale,
	)
}

function fill_rect(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	color: string,
	opacity = 1,
): void {
	ctx.fillStyle = color
	ctx.globalAlpha = opacity
	ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h))
	ctx.globalAlpha = 1
}
