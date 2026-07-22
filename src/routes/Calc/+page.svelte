<script>
  import init, { WasmSegment, WasmSubSegment, WasmTwoLaneHighways } from "HCM-middleware";
  import Error from "../+error.svelte";
  import { setReport } from '$lib/report';

    // Export variables
    export let lane_width;
    export let shoulder_width;
    export let apd;
    export let pmhvfl;
    export let rows_len;
    export let rows;

    function callingFunc(){
        calculate(rows_len, rows);
    }

    // Main calculation function
    function calculate(rows_len, rows){

        // Initial input variable settings
        var passing_type = [];
        var vc = 0; // Vertical class
        var rad = [];
        var sup_ele = [];
        var is_hc = true;
        var Vi = 0;
        var Vo = 0;
        var PHF = 0;
        var PHV = 0;
        var Spl = 0;
        var seg_length = 0;
        var seg_grade = 0;
        var LW = 0;
        var SW = 0;
        var APD = 0;
        var PMHVFL = 0; // percentage multiplier for heavy vehicles in the faster / passing lane

        // Initial variable settings
        var pass_min = 0;
        var pass_max = 0;
        var vd = 0;
        var demandFlow_v = [];
        var demandFlow_o = 0;
        var capacity = 0;
        var cap = [];
        var ver_cls = 0; // After step 3
        var ver_class = 0; // User input
        var ffs = 0;
        var sub_s = 0;
        var hc = 0; // Horizontal class --> It changes to parameter selection
        var seg_len = [];
        var avg_S = 0;
        var fd = [];
        var pf = []; // percent followers
        var PL_idx = []; // store passing lane's location
        var FDadj = [];
        var calc_fd = [];
        var fdF_num = 0;
        var segLOS = [];
        var LOS = '';
        var out = '';
        var tot_len = 0;
        var LPL = 0; // length of passing lane
        var cnt = 0; // to avoid undefined element in the array

        // 1D array
        var sub_S = new Array(rows_len); // subsegment speed // --> Causes problem
        var HC = new Array(rows_len); // horizontal class list
        var subSeg_len = new Array(rows_len);
        var subseg = new Array(rows_len); // subsegment length for store values, thus tangent is counted as one subsegment
        var tot_sublen = new Array(rows_len);

        // 2D array
        for (var i=0; i < sub_S.length; i++){
            sub_S[i] = new Array(rows[i].subrows.length+1);
            HC[i] = new Array(rows[i].subrows.length+1);
            subSeg_len[i] = new Array(rows[i].subrows.length+1);
            subseg[i] = new Array(rows[i].subrows.length+1); 
        }

        // Fixed values for the entire segments
        // Spl = document.getElementById("Spl_input").value;
        LW = lane_width;
        SW = shoulder_width;
        APD = apd;
        PMHVFL = pmhvfl;

        // Error variables
        var error_str = "";
        var error_flg = 0;

        var wasmSegment = [];

        // Initialization
        for(let i=0; i < rows_len; i++) {
            const row = rows[i];
            const subrows_len = row.subrows.length;

            const pass_type = row.passing_type;
            if (pass_type === "Passing Constrained") passing_type[i] = 0;
            else if (pass_type === "Passing Zone") passing_type[i] = 1;
            else if (pass_type === "Passing Lane") passing_type[i] = 2;


            Spl = row.seg_spl;
            vc = row.vertical_class;
            is_hc = row.is_hc;
            Vi = row.vi;
            Vo = row.vo;
            seg_length = row.seg_length;
            seg_grade = row.seg_grade;
            PHF = row.phf;
            PHV = row.phv;
            ver_class = row.vertical_class;

            let wasmSubSegment = [new WasmSubSegment()];

            if (is_hc && subrows_len > 0) {
                wasmSubSegment = row.subrows.map((subrow, j) => {
                    subSeg_len[i][j] = String(subrow.subseg_length);
                    rad[j] = String(subrow.design_radius);
                    sup_ele[j] = String(subrow.superelevation);

                    return new WasmSubSegment(
                        parseFloat(subSeg_len[i][j]),
                        0,
                        parseFloat(rad[j]),
                        0,
                        0,
                        parseFloat(sup_ele[j])
                    );
                });
            }

            const inst_wasmSegment = new WasmSegment(parseInt(passing_type[i]), seg_length, seg_grade, Spl, is_hc, Vi, Vo, 0.0, 0.0, 0, 0.0,
                          0.0, ver_class, wasmSubSegment, PHF, PHV , 0.0, 0.0, 0.0, 0);
            wasmSegment.push(inst_wasmSegment);

            seg_len[i] = seg_length;
        }

        var wasmTwoLaneHighways = new WasmTwoLaneHighways(wasmSegment, LW, SW, APD, PMHVFL);

        var fd_f = 0;
        var s_tot = 0;
        var fd_mid = 0;
        var fd_adj = 0;
        var fd_out = 0;
        const segReport = [];
        for (let i=0; i < rows_len; i++) {
            [pass_min, pass_max] = wasmTwoLaneHighways.identify_vertical_class(i);
            [vd, demandFlow_o, capacity] = wasmTwoLaneHighways.determine_demand_flow(i);
            ver_cls = wasmTwoLaneHighways.determine_vertical_alignment(i);
            ffs = wasmTwoLaneHighways.determine_free_flow_speed(i);
            var [s, hor_class] = wasmTwoLaneHighways.estimate_average_speed(i);
            pf[i] = wasmTwoLaneHighways.estimate_percent_followers(i);

            if (wasmTwoLaneHighways.get_segments()[i].passing_type == 2) {
                [fd, fd_mid] = wasmTwoLaneHighways.determine_follower_density_pl(i);
                fd_out = fd_mid;
            } else {
                fd = wasmTwoLaneHighways.determine_follower_density_pc_pz(i);
                // If the segment is within the effective length of PL section
            }
            fd_adj = wasmTwoLaneHighways.determine_adjustment_to_follower_density(i);

            if (wasmTwoLaneHighways.get_segments()[i].passing_type != 2) {
                if (fd_adj > 0.0) {
                    fd_out = fd_adj;
                } else {
                    fd_out = fd;
                }
            }
            fd_f += fd_out * wasmTwoLaneHighways.get_segments()[i].length;
            tot_len += wasmTwoLaneHighways.get_segments()[i].length;
            s_tot += s * wasmTwoLaneHighways.get_segments()[i].length;
            let los = wasmTwoLaneHighways.determine_segment_los(i, s, capacity);

            document.getElementById("ffs" + (i+1)).innerHTML = "" + Math.round(ffs*1000)/1000;
            document.getElementById("pf" + (i+1)).innerHTML = "" + Math.round(pf[i]*1000)/1000;
            document.getElementById("avgspd" + (i+1)).innerHTML = "" + Math.round(s*1000) / 1000;
            document.getElementById("fd" + (i+1)).innerHTML = "" + Math.round(fd_out*1000) / 1000;
            document.getElementById("seglos" + (i+1)).innerHTML = "" + los;
            segReport.push({
              ffs: Math.round(ffs * 100) / 100,
              avgspd: Math.round(s * 100) / 100,
              pf: Math.round(pf[i] * 100) / 100,
              fd: Math.round(fd_out * 100) / 100,
              los,
            });
        }
        fd_f = fd_f / tot_len;

        let average_speed = s_tot / tot_len;
        let fac_los = wasmTwoLaneHighways.determine_facility_los(fd_f, average_speed);

        // Output (LOS)
        document.getElementById("los").innerHTML = "Facility LOS: " + fac_los;
        // Facility Follower Density
        document.getElementById("fdF").innerHTML = "Facility Follower Density: " + Math.round(fd_f*1000)/1000;
        // Error
        document.getElementById("error").innerHTML = "Error message: " + out;

        setReport({
          chapter: 'Two-Lane Highways',
          chapterRef: 'HCM Chapter 15',
          href: '/hcm15',
          generatedAt: new Date().toLocaleString(),
          headline: { label: 'Facility LOS', value: fac_los },
          inputs: [
            { label: 'Lane width', value: `${lane_width} ft` },
            { label: 'Shoulder width', value: `${shoulder_width} ft` },
            { label: 'Access point density', value: `${apd} /mi` },
            { label: 'Heavy vehicles in passing lane', value: `${pmhvfl} %` },
            { label: 'Segments', value: rows_len },
          ],
          resultTable: {
            columns: ['Quantity', ...segReport.map((_, i) => `Segment ${i + 1}`)],
            rows: [
              ['Free-flow speed (mi/h)', ...segReport.map((r) => r.ffs)],
              ['Average speed (mi/h)', ...segReport.map((r) => r.avgspd)],
              ['Percent followers (%)', ...segReport.map((r) => r.pf)],
              ['Follower density (followers/mi)', ...segReport.map((r) => r.fd)],
              ['Segment LOS', ...segReport.map((r) => r.los)],
            ],
          },
          summary: [
            { label: 'Facility LOS', value: fac_los },
            { label: 'Facility follower density', value: `${Math.round(fd_f * 1000) / 1000} followers/mi` },
          ],
          methodology: [
            'HCM 7th Edition Chapter 15 (Two-Lane Highways).',
            'Service measure: follower density (followers/mi); the facility value is length-weighted across segments.',
            'Level of service is keyed on follower density; thresholds depend on posted speed (see the HCM).',
          ],
          diagram: {
            kind: 'twolane',
            props: { rows: JSON.parse(JSON.stringify(rows)), laneWidth: Number(lane_width) },
          },
        });

    }

</script>

<button type="submit" class="btn btn-primary calc-btn" on:click={() => callingFunc()}>Calculate</button>

<style>
  .calc-btn {
    background-color: #ea7317;
    border-color: #ea7317;
    color: #fff;
  }
  .calc-btn:hover {
    background-color: #c75e0a;
    border-color: #c75e0a;
  }
</style>
 <!-- on:click={() => submitted = true} -->