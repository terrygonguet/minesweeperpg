import { create_world, draw_world, handle_input, update_world } from "./game"
import "./style.css"

const canvas = document.querySelector<HTMLCanvasElement>("#game")!
const rect = canvas.getBoundingClientRect()
canvas.width = rect.width
canvas.height = rect.height

const ctx = canvas.getContext("2d")
if (ctx) {
	const world = create_world(21, 21)

	document.addEventListener("keydown", evt => {
		switch (evt.code) {
			case "KeyW":
				handle_input(world, { type: "keydown", key: "up" })
				break
			case "KeyS":
				handle_input(world, { type: "keydown", key: "down" })
				break
			case "KeyA":
				handle_input(world, { type: "keydown", key: "left" })
				break
			case "KeyD":
				handle_input(world, { type: "keydown", key: "right" })
				break
			case "KeyQ":
				handle_input(world, { type: "keydown", key: "attack" })
				break
			case "KeyE":
				handle_input(world, { type: "keydown", key: "loot" })
				break
		}
	})
	document.addEventListener("keyup", evt => {
		switch (evt.code) {
			case "KeyW":
				handle_input(world, { type: "keyup", key: "up" })
				break
			case "KeyS":
				handle_input(world, { type: "keyup", key: "down" })
				break
			case "KeyA":
				handle_input(world, { type: "keyup", key: "left" })
				break
			case "KeyD":
				handle_input(world, { type: "keyup", key: "right" })
				break
			case "KeyQ":
				handle_input(world, { type: "keyup", key: "attack" })
				break
			case "KeyE":
				handle_input(world, { type: "keyup", key: "loot" })
				break
		}
	})

	let previous = performance.now()
	const raf = (time: number) => {
		const delta = time - previous
		previous = time
		update_world(world, delta / 1000)
		draw_world(world, ctx)
		requestAnimationFrame(raf)
	}
	requestAnimationFrame(raf)
}
