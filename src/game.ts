import { vec2 } from "gl-matrix"

type World = {
	tiles: Tile[]
	fog: {
		opacity: number
		enemies: number
		treasures: number
		traps: number
	}[]
	entities: Entity[]
	new_entities: Entity[]
	width: number
	height: number
	input: {
		up: boolean
		down: boolean
		left: boolean
		right: boolean
		attack: boolean
		loot: boolean
	}
}

type Entity = Player | Monster | Loot | Treasure

type Player = {
	type: "player"
	position: vec2
	deleted: false
	fov: number
	health: number
	wealth: number
	speed: number
	cooldown: number
	cooldown_scale: number
	animation: {
		from: vec2
		t: number
	}
}

type Monster = {
	type: "monster"
	position: vec2
	deleted: boolean
	health: number
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

type Tile = number & { __brand: "Tile" }

const Tile = {
	NONE: 0 as Tile,
	Empty: 1 as Tile,
	Wall: 2 as Tile,
	DoorClosed: 3 as Tile,
	DoorOpen: 4 as Tile,
}

const TAU = 2 * Math.PI
const CELL_SIZE = 35

export function create_world(): World {
	const width = 21
	const height = 21
	const world: World = {
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
		input: {
			up: false,
			down: false,
			left: false,
			right: false,
			attack: false,
			loot: false,
		},
	}

	world.entities.push({
		type: "player",
		position: vec2.fromValues(Math.floor(width / 2), Math.floor(height / 2)),
		deleted: false,
		fov: 2.5,
		health: 5,
		wealth: 0,
		speed: 4,
		cooldown: 0,
		cooldown_scale: 1,
		animation: { from: vec2.create(), t: 1 },
	})

	for (let n = 0; n < 10; n++) {
		const x = Math.floor(Math.random() * (width - 2)) + 1
		const y = Math.floor(Math.random() * (width - 2)) + 1
		if (world.entities.some(entity => entity.position[0] == x && entity.position[1] == y)) continue
		if (Math.random() < 0.5) {
			world.entities.push({ type: "monster", position: vec2.fromValues(x, y), deleted: false, health: 5 })
		} else {
			world.entities.push({ type: "treasure", position: vec2.fromValues(x, y), deleted: false, value: 3 })
		}
	}

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const is_wall = x == 0 || y == 0 || x == width - 1 || y == height - 1
			set_at_xy(world.tiles, x, y, width, is_wall ? Tile.Wall : Tile.Empty)
		}
	}

	recompute_fog(world)
	return world
}

export function draw_world(world: World, ctx: CanvasRenderingContext2D) {
	const { width, height } = ctx.canvas

	ctx.reset()

	ctx.fillStyle = "#333"
	ctx.fillRect(0, 0, width, height)

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

		switch (tile) {
			case Tile.Empty:
				ctx.fillStyle = "white"
				ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
				break
			case Tile.Wall:
				ctx.fillStyle = "black"
				ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
				break
			case Tile.DoorClosed:
				ctx.fillStyle = "brown"
				ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
				break
			case Tile.DoorOpen:
				ctx.fillStyle = "brown"
				ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE / 5, CELL_SIZE)
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
				ctx.fillStyle = "red"
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
				ctx.fillStyle = "green"
				ctx.arc(x * CELL_SIZE, y * CELL_SIZE, 0.13 * CELL_SIZE, 0, TAU)
			}
			ctx.fill()
		}
		if (fog.opacity != 0) {
			ctx.fillStyle = "gray"
			ctx.globalAlpha = fog.opacity
			ctx.fillRect(0, 0, CELL_SIZE, CELL_SIZE)
		}
		ctx.restore()
	}

	ctx.save()
	for (const entity of world.entities) {
		const fog = get_at_vec2(world.fog, entity.position, world.width)
		if (fog.opacity == 1) continue
		switch (entity.type) {
			case "player": {
				const player = entity
				const player_sprite_pos = vec2.lerp(
					vec2.create(),
					player.animation.from,
					player.position,
					player.animation.t,
				)
				ctx.beginPath()
				ctx.fillStyle = "black"
				ctx.arc(
					(player_sprite_pos[0] + 0.5) * CELL_SIZE,
					(player_sprite_pos[1] + 0.5) * CELL_SIZE,
					CELL_SIZE / 3.5,
					0,
					TAU,
				)
				ctx.fill()
				break
			}
			case "monster":
				ctx.beginPath()
				ctx.fillStyle = "red"
				ctx.arc(
					(entity.position[0] + 0.5) * CELL_SIZE,
					(entity.position[1] + 0.5) * CELL_SIZE,
					CELL_SIZE / 3.5,
					0,
					TAU,
				)
				ctx.fill()
				break
			case "loot":
				ctx.fillStyle = "gold"
				ctx.fillRect(
					(entity.position[0] + 0.3) * CELL_SIZE,
					(entity.position[1] + 0.3) * CELL_SIZE,
					0.4 * CELL_SIZE,
					0.4 * CELL_SIZE,
				)
				break
			case "treasure":
				ctx.fillStyle = "green"
				ctx.fillRect(
					(entity.position[0] + 0.2) * CELL_SIZE,
					(entity.position[1] + 0.2) * CELL_SIZE,
					0.6 * CELL_SIZE,
					0.6 * CELL_SIZE,
				)
				break
		}
	}
	ctx.restore()

	ctx.save()
	ctx.beginPath()
	for (let x = 0; x <= world.width; x++) {
		ctx.moveTo(x * CELL_SIZE, 0)
		ctx.lineTo(x * CELL_SIZE, world.height * CELL_SIZE)
	}
	for (let y = 0; y <= world.height; y++) {
		ctx.moveTo(0, y * CELL_SIZE)
		ctx.lineTo(world.width * CELL_SIZE, y * CELL_SIZE)
	}
	ctx.strokeStyle = "lightgray"
	ctx.lineWidth = 0.5
	ctx.stroke()
	ctx.restore()
}

export function update_world(world: World, delta: number) {
	for (const entity of world.entities) {
		switch (entity.type) {
			case "player": {
				const player = entity
				const movement = vec2.fromValues(
					+world.input.right - +world.input.left,
					+world.input.down - +world.input.up,
				)
				if (vec2.squaredLength(movement) != 0 && player.cooldown == 0) {
					let can_move = false
					const new_pos = vec2.add(vec2.create(), player.position, movement)
					const tile = get_at_vec2(world.tiles, new_pos, world.width)
					switch (tile) {
						case Tile.Empty:
						case Tile.DoorOpen:
							can_move = true
							break
						case Tile.DoorClosed:
							set_at_vec2(world.tiles, new_pos, world.width, Tile.DoorOpen)
							recompute_fog(world)
							break
					}

					if (can_move) {
						for (const entity of entities_at(world, new_pos)) {
							switch (entity.type) {
								case "player":
									can_move = false
									break
								case "monster": {
									can_move = false
									player.health--
									player.cooldown = 0.5
									reveal(world, new_pos, true)
									break
								}
								case "loot": {
									player.wealth += entity.value
									entity.deleted = true
									reveal(world, new_pos, true)
									break
								}
								case "treasure":
									can_move = false
									player.cooldown = 0.3
									entity.deleted = true
									world.new_entities.push({
										type: "loot",
										position: entity.position,
										deleted: false,
										value: entity.value,
									})
									break
							}
						}
					}

					if (can_move) move_player(player, new_pos)
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

				player.cooldown = Math.max(player.cooldown - delta * player.cooldown_scale, 0)
				player.animation.t = Math.min(player.animation.t + delta * 5 * player.cooldown_scale, 1)

				break
			}
		}
	}
	world.input.attack = false
	world.input.loot = false

	for (const fog of world.fog) {
		if (fog.opacity != 0 && fog.opacity != 1) fog.opacity = Math.max(fog.opacity - delta * 5, 0)
	}

	world.entities = world.entities.filter(entity => !entity.deleted).concat(world.new_entities)
	world.new_entities = []
	recompute_fog(world)
}

type InputKey = "up" | "down" | "left" | "right" | "attack" | "loot"
type Input = { type: "keydown"; key: InputKey } | { type: "keyup"; key: InputKey }
export function handle_input(world: World, input: Input) {
	switch (input.key) {
		case "up":
			world.input.up = input.type == "keydown"
			break
		case "down":
			world.input.down = input.type == "keydown"
			break
		case "left":
			world.input.left = input.type == "keydown"
			break
		case "right":
			world.input.right = input.type == "keydown"
			break
		case "attack": {
			world.input.attack = input.type == "keydown"
			break
		}
		case "loot": {
			world.input.loot = input.type == "keydown"
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

function move_player(player: Player, to: vec2) {
	vec2.copy(player.animation.from, player.position)
	vec2.copy(player.position, to)
	player.cooldown = 0.2
	player.cooldown_scale = 1 / vec2.distance(player.animation.from, player.position)
	player.animation.t = 0
}

function reveal(world: World, pos: vec2, full_reveal = false): void {
	const fog = get_at_vec2(world.fog, pos, world.width)
	fog.opacity = full_reveal ? 0 : 0.9999
}

function* entities_at(world: World, pos: vec2, include_deleted = false): Generator<Entity, void, undefined> {
	for (const entity of world.entities) {
		if (vec2.equals(entity.position, pos) && (!entity.deleted || include_deleted)) yield entity
	}
}

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
