use wasm_bindgen::prelude::*;

use traffic_sim::{Simulation, LinkAttributes, VehicleAttributes};
use traffic_sim::math::{LineSegment2d, Point2d};

// import Javascript's alert method to Rust
#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
}

// export Rust function greet to be used in JS/TS, the same function signature will be used in JS/TS
#[wasm_bindgen]
pub fn greet(str: &str) {
    alert(&format!("Hello, {}!", str));
}

// Create a simulation
#[wasm_bindgen]
pub fn visualize_results() {
    let mut simulation = Simulation::new();

    // Add a link, which is a single lane of traffic
    // This one is a straight line 100m long
    let link_id = simulation.add_link(&LinkAttributes {
        curve: &LineSegment2d::from_ends(Point2d::new(0.0, 0.0), Point2d::new(100.0, 0.0)),
        speed_limit: 16.6667, // m/s (60km/h)
    });

    // Add a vehicle to the start of the link we just created
    let veh_id = simulation.add_vehicle(&VehicleAttributes {
        width: 2.0, // m
        length: 5.0, // m
        wheel_base: 1.5, // m
        max_acc: 2.0, // m
        comf_dec: 2.0, // m
    }, link_id);

    // Simulate 10 frames, each advancing time by 0.1s.
    // Each frame, print out the coordinates of our single vehicle
    for _ in 0..10 {
        simulation.step(0.1);
        alert(&format!("Vehicle is at {:?}", simulation.get_vehicle(veh_id).position()));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = 2 + 2;
        assert_eq!(result, 4);
    }
}
