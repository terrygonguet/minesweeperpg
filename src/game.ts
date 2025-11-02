import { vec2 } from "gl-matrix"

type Cell = { type: "wall" } | { type: "empty" } | { type: "treasure" } | { type: "enemy" } | { type: "trap" }

type Player = {
	position: vec2
	fov: number
	state: "normal" | "attack" | "loot"
	health: number
	wealth: number
	speed: number
}

type World = {
	grid: (Cell | null)[]
	fog: {
		opacity: number
		enemies: number
		treasures: number
		traps: number
	}[]
	width: number
	height: number
	player: Player
	input: {
		up: boolean
		down: boolean
		left: boolean
		right: boolean
		attack: boolean
		loot: boolean
	}
}

type InputKey = "up" | "down" | "left" | "right" | "attack" | "loot"
type Input = { type: "keydown"; key: InputKey } | { type: "keyup"; key: InputKey }

const FOG_RATIO = 4
const CELL_SIZE = 35
const FOG_SIZE = CELL_SIZE / FOG_RATIO

export function create_world(width: number, height: number): World {
	const world: World = {
		width,
		height,
		grid: Array.from({ length: width * height }, () => null),
		fog: Array.from({ length: width * height * FOG_RATIO * FOG_RATIO }, () => ({
			opacity: 1,
			enemies: 0,
			traps: 0,
			treasures: 0,
		})),
		player: {
			position: vec2.fromValues(width / 2, height / 2),
			fov: 3.5,
			state: "normal",
			health: 3,
			wealth: 0,
			speed: 3,
		},
		input: {
			up: false,
			down: false,
			left: false,
			right: false,
			attack: false,
			loot: false,
		},
	}

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (x == 0 || y == 0 || x == width - 1 || y == height - 1) world.grid[y * width + x] = { type: "wall" }
			else world.grid[y * width + x] = { type: "empty" }
		}
	}

	for (let i = 0; i < 10; i++) {
		const x = Math.floor(Math.random() * (width - 2)) + 1
		const y = Math.floor(Math.random() * (height - 2)) + 1
		world.grid[y * width + x] = Math.random() < 0.5 ? { type: "enemy" } : { type: "treasure" }
	}

	recompute_fog(world)
	return world
}

export function draw_world(world: World, ctx: CanvasRenderingContext2D) {
	const { width, height } = ctx.canvas

	ctx.save()

	ctx.fillStyle = "skyblue"
	ctx.fillRect(0, 0, width, height)

	ctx.translate(
		Math.round(width / 2 - (world.width * CELL_SIZE) / 2),
		Math.round(height / 2 - (world.height * CELL_SIZE) / 2),
	)
	ctx.fillStyle = "wheat"
	ctx.fillRect(0, 0, world.width * CELL_SIZE, world.height * CELL_SIZE)

	for (let y = 0; y < world.height; y++) {
		for (let x = 0; x < world.width; x++) {
			const cell = world.grid[y * world.width + x]
			if (!cell) continue

			ctx.save()
			switch (cell.type) {
				case "empty":
					ctx.fillStyle = "white"
					ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
					break
				case "wall":
					ctx.fillStyle = "black"
					ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
					break
				case "enemy":
					ctx.fillStyle = "white"
					ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
					ctx.fillStyle = "red"
					ctx.beginPath()
					ctx.arc(
						x * CELL_SIZE + CELL_SIZE / 2,
						y * CELL_SIZE + CELL_SIZE / 2,
						CELL_SIZE / 3.5,
						0,
						2 * Math.PI,
					)
					ctx.fill()
					break
				case "treasure":
					ctx.fillStyle = "white"
					ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
					ctx.fillStyle = "green"
					ctx.fillRect(x * CELL_SIZE + 10, y * CELL_SIZE + 10, CELL_SIZE - 20, CELL_SIZE - 20)
					break
				case "trap":
					ctx.fillStyle = "white"
					ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
					ctx.beginPath()
					ctx.fillStyle = "orange"
					ctx.moveTo(x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + 5)
					ctx.lineTo(x * CELL_SIZE + CELL_SIZE - 5, y * CELL_SIZE + CELL_SIZE - 5)
					ctx.lineTo(x * CELL_SIZE + 5, y * CELL_SIZE + CELL_SIZE - 5)
					ctx.closePath()
					ctx.fill()
					break
			}
			ctx.restore()
		}
	}

	for (let i = 0; i < world.fog.length; i++) {
		const fog = world.fog[i]
		const x = i % (world.width * FOG_RATIO)
		const y = Math.floor(i / (world.width * FOG_RATIO))
		const is_empty = fog.enemies + fog.traps + fog.treasures == 0

		ctx.save()
		let draw_rect = false
		if (fog.opacity == 1) {
			ctx.fillStyle = "gray"
			draw_rect = true
		} else if (is_empty && fog.opacity > 0) {
			ctx.globalAlpha = fog.opacity
			ctx.fillStyle = "gray"
			draw_rect = true
		} else if (!is_empty) {
			ctx.globalAlpha = fog.opacity || 1
			if (fog.enemies > 0) ctx.fillStyle = "red"
			else if (fog.traps > 0) ctx.fillStyle = "orange"
			else if (fog.treasures > 0) ctx.fillStyle = "green"
			draw_rect = true
		}
		if (draw_rect)
			ctx.fillRect(Math.floor(x * FOG_SIZE), Math.floor(y * FOG_SIZE), Math.ceil(FOG_SIZE), Math.ceil(FOG_SIZE))
		ctx.restore()
	}

	ctx.save()
	switch (world.player.state) {
		case "normal":
			ctx.fillStyle = "black"
			break
		case "attack":
			ctx.fillStyle = "darkred"
			break
		case "loot":
			ctx.fillStyle = "darkgreen"
			break
	}
	ctx.beginPath()
	ctx.arc(world.player.position[0] * CELL_SIZE, world.player.position[1] * CELL_SIZE, CELL_SIZE / 3.5, 0, 2 * Math.PI)
	ctx.fill()
	ctx.restore()
	ctx.restore()
}

export function update_world(world: World, delta: number) {
	const movement = vec2.fromValues(+world.input.right - +world.input.left, +world.input.down - +world.input.up)
	vec2.normalize(movement, movement)
	vec2.scaleAndAdd(world.player.position, world.player.position, movement, world.player.speed * delta)

	const cell_pos = vec2.floor(vec2.create(), world.player.position)
	const cell = get_at(world.grid, cell_pos, world.width)
	const fog_pos = vec2.scale(vec2.create(), world.player.position, FOG_RATIO)
	vec2.floor(fog_pos, fog_pos)
	const fog = get_at(world.fog, fog_pos, world.width * FOG_RATIO)
	if (cell) {
		switch (cell.type) {
			case "empty":
				break
			case "treasure":
				if (world.player.state == "loot" || fog.opacity != 1) {
					world.player.wealth++
				}
				;(cell as Cell).type = "empty"
				recompute_fog(world)
				world.player.state = "normal"
				console.log(world.player)
				break
			case "enemy":
				if (world.player.state == "attack") {
					;(cell as Cell).type = "treasure"
				} else {
					world.player.health--
				}
				world.player.state = "normal"
				console.log(world.player)
				if (fog.opacity == 1) {
					const pos = vec2.scale(vec2.create(), cell_pos, FOG_RATIO)
					reveal(world, pos, vec2.fromValues(FOG_RATIO, FOG_RATIO))
				}
				recompute_fog(world)
				break
		}
	}

	const fov_floor = Math.floor(world.player.fov * FOG_RATIO)
	const fov_ceil = Math.ceil(world.player.fov * FOG_RATIO)
	const temp = vec2.create()
	for (let dx = -fov_floor; dx <= fov_ceil; dx++) {
		for (let dy = -fov_floor; dy <= fov_ceil; dy++) {
			vec2.set(temp, dx, dy)
			vec2.add(temp, temp, fog_pos)
			vec2.scale(temp, temp, 1 / FOG_RATIO)
			const dist = vec2.distance(temp, world.player.position)
			if (dist > world.player.fov) continue

			const pos = vec2.fromValues(fog_pos[0] + dx, fog_pos[1] + dy)
			if (!is_in_bounds(pos, world.width * FOG_RATIO, world.height * FOG_RATIO)) continue

			const fog = get_at(world.fog, pos, world.width * FOG_RATIO)
			if (fog.opacity == 0) continue
			if (dist <= Math.SQRT2 && fog.enemies + fog.traps + fog.treasures == 0) {
				fog.opacity = 0
				continue
			}

			const taget_opacity = compute_target_opacity(dist / world.player.fov)
			neighbours: for (let dx = -1; dx <= 1; dx++) {
				for (let dy = -1; dy <= 1; dy++) {
					const neighbour_pos = vec2.set(temp, pos[0] + dx, pos[1] + dy)
					if (!is_in_bounds(neighbour_pos, world.width * FOG_RATIO, world.height * FOG_RATIO)) continue

					const neighbour_fog = get_at(world.fog, neighbour_pos, world.width * FOG_RATIO)
					if (
						neighbour_fog.enemies + neighbour_fog.traps + neighbour_fog.treasures == 0 &&
						neighbour_fog.opacity != 1
					) {
						fog.opacity = Math.min(fog.opacity, taget_opacity)
						break neighbours
					}
				}
			}
		}
	}
}

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
		case "attack":
			world.input.attack = input.type == "keydown"
			if (world.input.attack) {
				if (world.player.state == "attack") world.player.state = "normal"
				else world.player.state = "attack"
			}
			break
		case "loot":
			world.input.loot = input.type == "keydown"
			if (world.input.loot) {
				if (world.player.state == "loot") world.player.state = "normal"
				else world.player.state = "loot"
			}
			break
	}
}

function recompute_fog(world: World): void {
	for (const fog of world.fog) {
		fog.enemies = 0
		fog.traps = 0
		fog.treasures = 0
	}

	const fog_pos = vec2.create()
	for (let i = 0; i < world.grid.length; i++) {
		const cell = world.grid[i]
		if (!cell || cell.type == "empty" || cell.type == "wall") continue

		const x = i % world.width
		const y = Math.floor(i / world.width)
		const delta_enemies = cell.type == "enemy" ? 1 : 0
		const delta_traps = cell.type == "trap" ? 1 : 0
		const delta_treasures = cell.type == "treasure" ? 1 : 0
		for (let dx = -1; dx < FOG_RATIO + 1; dx++) {
			for (let dy = -1; dy < FOG_RATIO + 1; dy++) {
				vec2.set(fog_pos, x * FOG_RATIO + dx, y * FOG_RATIO + dy)
				if (!is_in_bounds(fog_pos, world.width * FOG_RATIO, world.height * FOG_RATIO)) continue
				const fog = get_at(world.fog, fog_pos, world.width * FOG_RATIO)
				if (fog.opacity != 1) continue
				fog.enemies += delta_enemies
				fog.traps += delta_traps
				fog.treasures += delta_treasures
			}
		}
	}
}

function reveal(world: World, pos: vec2, size: vec2): void {
	const temp = vec2.create()
	for (let x = 0; x < size[0]; x++) {
		for (let y = 0; y < size[1]; y++) {
			vec2.set(temp, pos[0] + x, pos[1] + y)
			if (!is_in_bounds(temp, world.width * FOG_RATIO, world.height * FOG_RATIO)) continue
			const fog = get_at(world.fog, temp, world.width * FOG_RATIO)
			fog.opacity = 0
		}
	}
}

function get_at<T>(arr: T[], pos: vec2, stride: number): T {
	return arr[pos[1] * stride + pos[0]]
}

function is_in_bounds(pos: vec2, width: number, height: number): boolean {
	return pos[0] >= 0 && pos[1] >= 0 && pos[0] < width && pos[1] < height
}

function compute_target_opacity(t: number): number {
	if (t < 0.8) return 0
	else return (t - 0.8) * 5
}

// function* neighbours<T>(arr: T[], pos: vec2, width: number, height: number, distance = 1): Generator<T> {
// 	const temp = vec2.create()
// 	for (let dx = -distance; dx <= distance; dx++) {
// 		for (let dy = -distance; dy <= distance; dy++) {
// 			vec2.set(temp, pos[0] + dx, pos[1] + dy)
// 			if (is_in_bounds(temp, width, height)) yield get_at(arr, temp, width)
// 		}
// 	}
// }
