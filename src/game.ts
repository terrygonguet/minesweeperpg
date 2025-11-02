import { vec2 } from "gl-matrix"

type Cell = { type: "wall" } | { type: "empty" } | { type: "treasure" } | { type: "enemy" } | { type: "trap" }

type Player = {
	position: vec2
	fov: number
	state: "normal" | "attack" | "loot"
	health: number
	wealth: number
	speed: number
	animation: {
		from: vec2
		t: number
	}
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

const CELL_SIZE = 35

export function create_world(width: number, height: number): World {
	const world: World = {
		width,
		height,
		grid: Array.from({ length: width * height }, () => null),
		fog: Array.from({ length: width * height }, () => ({
			opacity: 1,
			enemies: 0,
			traps: 0,
			treasures: 0,
		})),
		player: {
			position: vec2.fromValues(Math.floor(width / 2), Math.floor(height / 2)),
			fov: 2.5,
			state: "normal",
			health: 3,
			wealth: 0,
			speed: 4,
			animation: {
				from: vec2.create(),
				t: 1,
			},
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

	for (let i = 0; i < 30; i++) {
		const x = Math.floor(Math.random() * (width - 2)) + 1
		const y = Math.floor(Math.random() * (height - 2)) + 1
		switch (Math.floor(Math.random() * 3)) {
			case 0:
				world.grid[y * width + x] = { type: "enemy" }
				break
			case 1:
				world.grid[y * width + x] = { type: "treasure" }
				break
			case 2:
				world.grid[y * width + x] = { type: "trap" }
				break
		}
	}

	recompute_fog(world)
	return world
}

export function draw_world(world: World, ctx: CanvasRenderingContext2D) {
	const { width, height } = ctx.canvas

	ctx.save()

	ctx.fillStyle = "#333"
	ctx.fillRect(0, 0, width, height)

	ctx.translate(
		Math.round(width / 2 - (world.width * CELL_SIZE) / 2),
		Math.round(height / 2 - (world.height * CELL_SIZE) / 2),
	)

	for (let y = 0; y < world.height; y++) {
		for (let x = 0; x < world.width; x++) {
			const cell = world.grid[y * world.width + x]
			if (!cell) continue

			ctx.save()
			ctx.translate(x * CELL_SIZE, y * CELL_SIZE)
			switch (cell.type) {
				case "empty":
					ctx.fillStyle = "white"
					ctx.fillRect(0, 0, CELL_SIZE, CELL_SIZE)
					break
				case "wall":
					ctx.fillStyle = "black"
					ctx.fillRect(0, 0, CELL_SIZE, CELL_SIZE)
					break
				case "enemy":
					ctx.fillStyle = "white"
					ctx.fillRect(0, 0, CELL_SIZE, CELL_SIZE)
					ctx.fillStyle = "red"
					ctx.beginPath()
					ctx.arc(CELL_SIZE / 2, CELL_SIZE / 2, CELL_SIZE / 3.5, 0, 2 * Math.PI)
					ctx.fill()
					break
				case "treasure":
					ctx.fillStyle = "white"
					ctx.fillRect(0, 0, CELL_SIZE, CELL_SIZE)
					ctx.fillStyle = "green"
					ctx.fillRect(10, 10, CELL_SIZE - 20, CELL_SIZE - 20)
					break
				case "trap":
					ctx.fillStyle = "white"
					ctx.fillRect(0, 0, CELL_SIZE, CELL_SIZE)
					ctx.beginPath()
					ctx.fillStyle = "orange"
					ctx.moveTo(CELL_SIZE / 2, 5)
					ctx.lineTo(CELL_SIZE - 5, CELL_SIZE - 5)
					ctx.lineTo(5, CELL_SIZE - 5)
					ctx.closePath()
					ctx.fill()
					break
			}

			const fog = world.fog[y * world.width + x]
			if (fog.opacity != 0) {
				ctx.fillStyle = "gray"
				ctx.globalAlpha = fog.opacity
				ctx.fillRect(0, 0, CELL_SIZE, CELL_SIZE)
			} else {
				let i = 0
				const num_objects = fog.enemies + fog.traps + fog.treasures
				const positions = setups[num_objects]
				ctx.beginPath()
				for (let n = 0; n < fog.enemies; n++) {
					const [x, y] = positions[i++]
					ctx.fillStyle = "red"
					ctx.arc(x * CELL_SIZE, y * CELL_SIZE, 0.13 * CELL_SIZE, 0, 2 * Math.PI)
				}
				ctx.fill()
				ctx.beginPath()
				for (let n = 0; n < fog.traps; n++) {
					const [x, y] = positions[i++]
					ctx.fillStyle = "orange"
					ctx.arc(x * CELL_SIZE, y * CELL_SIZE, 0.13 * CELL_SIZE, 0, 2 * Math.PI)
				}
				ctx.fill()
				ctx.beginPath()
				for (let n = 0; n < fog.treasures; n++) {
					const [x, y] = positions[i++]
					ctx.fillStyle = "green"
					ctx.arc(x * CELL_SIZE, y * CELL_SIZE, 0.13 * CELL_SIZE, 0, 2 * Math.PI)
				}
				ctx.fill()
			}
			ctx.restore()
		}
	}

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

	ctx.save()
	const player_sprite_pos = vec2.lerp(
		vec2.create(),
		world.player.animation.from,
		world.player.position,
		world.player.animation.t,
	)
	ctx.translate(player_sprite_pos[0] * CELL_SIZE, player_sprite_pos[1] * CELL_SIZE)
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
	ctx.arc(0.5 * CELL_SIZE, 0.5 * CELL_SIZE, CELL_SIZE / 3.5, 0, 2 * Math.PI)
	ctx.fill()
	ctx.restore()

	ctx.restore()
}

export function update_world(world: World, delta: number) {
	const movement = vec2.fromValues(+world.input.right - +world.input.left, +world.input.down - +world.input.up)
	if (vec2.length(movement) != 0 && world.player.animation.t == 1) {
		vec2.copy(world.player.animation.from, world.player.position)
		world.player.animation.t = 0

		const new_pos = vec2.add(vec2.create(), world.player.position, movement)
		const cell = get_at(world.grid, new_pos, world.width)
		const fog = get_at(world.fog, new_pos, world.width)

		if (cell) {
			switch (cell.type) {
				case "empty":
					vec2.copy(world.player.position, new_pos)
					break
				case "treasure":
					if (world.player.state == "loot" || fog.opacity != 1) {
						world.player.wealth++
					}
					;(cell as Cell).type = "empty"
					world.player.state = "normal"
					vec2.copy(world.player.position, new_pos)
					recompute_fog(world)

					console.log(world.player)
					break
				case "enemy":
					if (world.player.state == "attack") {
						;(cell as Cell).type = "treasure"
					} else {
						world.player.health--
					}
					world.player.state = "normal"
					fog.opacity -= 0.0001
					recompute_fog(world)

					console.log(world.player)
					break
			}
		}
	}

	// for each cell in view range
	const temp = vec2.create()
	const fov_floor = Math.floor(world.player.fov)
	const fov_ceil = Math.ceil(world.player.fov)
	for (let dx = -fov_floor; dx <= fov_ceil; dx++) {
		for (let dy = -fov_floor; dy <= fov_ceil; dy++) {
			const dist = Math.hypot(dx, dy)
			if (dist > world.player.fov) continue

			const cur_pos = vec2.fromValues(world.player.position[0] + dx, world.player.position[1] + dy)
			if (!is_in_bounds(cur_pos, world.width, world.height)) continue

			const cur_fog = get_at(world.fog, cur_pos, world.width)
			if (cur_fog.opacity == 0) continue
			if (dist == 0) {
				cur_fog.opacity = 0
				continue
			}

			// we reveal if at least one 0 neighbour has been revealed
			neighbours: for (let dx = -1; dx <= 1; dx++) {
				for (let dy = -1; dy <= 1; dy++) {
					const neighbour_pos = vec2.set(temp, cur_pos[0] + dx, cur_pos[1] + dy)
					if (!is_in_bounds(neighbour_pos, world.width, world.height)) continue

					const neighbour_fog = get_at(world.fog, neighbour_pos, world.width)
					if (
						neighbour_fog.enemies + neighbour_fog.traps + neighbour_fog.treasures == 0 &&
						neighbour_fog.opacity != 1
					) {
						cur_fog.opacity -= 0.0001
						break neighbours
					}
				}
			}
		}
	}

	for (const fog of world.fog) {
		if (fog.opacity != 0 && fog.opacity != 1) fog.opacity = Math.max(fog.opacity - delta * 5, 0)
	}
	const player_move_dist = vec2.distance(world.player.animation.from, world.player.position)
	world.player.animation.t = Math.min(world.player.animation.t + delta * (world.player.speed / player_move_dist), 1)
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

function recompute_fog(world: World) {
	for (const fog of world.fog) {
		fog.enemies = 0
		fog.traps = 0
		fog.treasures = 0
	}
	for (let i = 0; i < world.fog.length; i++) {
		const fog = world.fog[i]!
		const x = i % world.width
		const y = Math.floor(i / world.width)
		for (let dx = -1; dx <= 1; dx++) {
			for (let dy = -1; dy <= 1; dy++) {
				const cell = world.grid[(y + dy) * world.width + x + dx]
				const neighbour = world.fog[(y + dy) * world.width + x + dx]
				if (!cell || neighbour.opacity != 1) continue
				else if (cell.type == "enemy") fog.enemies++
				else if (cell.type == "treasure") fog.treasures++
				else if (cell.type == "trap") fog.traps++
			}
		}
	}
}

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

function get_at<T>(arr: T[], pos: vec2, stride: number): T {
	return arr[pos[1] * stride + pos[0]]
}

function is_in_bounds(pos: vec2, width: number, height: number): boolean {
	return pos[0] >= 0 && pos[1] >= 0 && pos[0] < width && pos[1] < height
}
