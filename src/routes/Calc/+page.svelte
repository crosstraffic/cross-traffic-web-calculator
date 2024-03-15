<script type="text/javascript">
  import init, { WasmSegment, WasmSubSegment, WasmTwoLaneHighways } from "HCM-middleware";

    // Export variables
    export let rows_len;
    export let rows;
    // export let data;
    // let { rows_len, rows } = data;

    function callingFunc(){
        calculate(rows_len, rows);
    }

    // Main calculation function
    function calculate(rows_len, rows){

        // Initial input variable settings
        var passing_type = [];
        var pass_type = '';
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
        for (var i=0;i<sub_S.length;i++){
            sub_S[i] = new Array(rows[i].subrows.length+1);
            HC[i] = new Array(rows[i].subrows.length+1);
            subSeg_len[i] = new Array(rows[i].subrows.length+1);
            subseg[i] = new Array(rows[i].subrows.length+1); 
        }

        // Fixed values for the entire segments
        // Spl = document.getElementById("Spl_input").value;
        LW = document.getElementById("LW_input").value;
        SW = document.getElementById("SW_input").value;
        APD = document.getElementById("APD_input").value;
        PMHVFL = document.getElementById("PMHVFL_input").value;

        // Error variables
        var error_str = "";
        var error_flg = 0;

        for(let i=0; i < rows_len; i++){
            tot_len += parseFloat(document.getElementById("seg_length"+(i+1)).value);
        }
        
        var wasmSegment = new Array(rows_len);
        // Initialization
        for(let i=0; i < rows_len; i++) {
            var subrows_len = rows[i].subrows.length;
            pass_type = document.getElementById("passing_type"+(i+1)).value;
            Spl = document.getElementById("seg_Spl"+(i+1)).value;
            vc = document.getElementById("vc_select"+(i+1)).value;
            is_hc = document.getElementById("is_hc"+(i+1)).checked;
            Vi = document.getElementById("vi_input"+(i+1)).value;
            Vo = document.getElementById("vo_input"+(i+1)).value;
            seg_length = document.getElementById("seg_length"+(i+1)).value;
            seg_grade = document.getElementById("seg_grade"+(i+1)).value;
            PHF = document.getElementById("PHF_input"+(i+1)).value;
            PHV = document.getElementById("PHV_input"+(i+1)).value;
            ver_class = document.getElementById("vc_select"+(i+1)).value;

            var wasmSubSegment = new Array(subrows_len);
            wasmSubSegment[0] = WasmSubSegment.new(0.0, 0.0, 0, 0.0, 0.0);

            if (is_hc == true && subrows_len > 0){
                for (let j=0; j < subrows_len; j++){
                    subSeg_len[i][j] = document.getElementById("hc_table"+(i+1)).getElementsByClassName("subseg_len"+(j+1))[0].value / 5280; // foot to mile
                    rad[j] = document.getElementById("hc_table"+(i+1)).getElementsByClassName("design_radius"+(j+1))[0].value;
                    sup_ele[j] = document.getElementById("hc_table"+(i+1)).getElementsByClassName("superelevation"+(j+1))[0].value;
                    wasmSubSegment[j] = WasmSubSegment.new(subSeg_len[i][j], 0.0, 0, rad[j], sup_ele[j]);
                }
              console.log(wasmSubSegment);
            }

            console.log(ver_class);
            wasmSegment[i] = WasmSegment.new(parseInt(pass_type), seg_length, seg_grade, Spl, is_hc, Vi, Vo, 0.0, 0.0, 0, 0.0,
                          0.0, ver_class, wasmSubSegment, PHF, PHV, 0.0, 0.0, 0);
        }

        var wasmTwoLaneHighways = WasmTwoLaneHighways.new(wasmSegment, LW, SW, APD, PMHVFL, 0.0);

        // For each Segment
        for(let i=0; i < rows_len; i++) {
            seg_len[i] = seg_length;
            tot_sublen[i] = 0;
            if (is_hc == false) subrows_len = 0;

            if (pass_type != "" && pass_type != 'TYPE'){
                passing_type[i] = pass_type;
                // Step 1
                [pass_min, pass_max] = wasmTwoLaneHighways.identify_vertical_class(i);

                // out = pass_min.toString() + ',' + pass_max.toString();
                // Step 2: Determine demand flow rates and capacity
                if (Vi != "" && Vo != "" && (PHF != "" && PHF >= 0) && (PHV != "" && PHV >= 0)){
                    [vd, demandFlow_o, capacity] = wasmTwoLaneHighways.determine_demand_flow(i);
                    demandFlow_v[i] = vd;
                    cap[i] = capacity;

                    // Step 3: Determine vertical alignment classification
                    if (seg_length != "" && seg_grade != ""){
                        ver_cls = wasmTwoLaneHighways.determine_vertical_alignment(i);

                        if (Spl != "" && (SW != "" && LW != "")){
                            // Step 4: Determine free-flow speed
                            ffs = wasmTwoLaneHighways.determine_free_flow_speed(i);

                            // Step 5: Estimate average speed
                            // For each subsegment
                            if (is_hc == true && subrows_len > 0){
                                for (let j=0; j < subrows_len; j++){
                                    subSeg_len[i][j] = document.getElementById("hc_table"+(i+1)).getElementsByClassName("subseg_len"+(j+1))[0].value / 5280; // foot to mile
                                    rad[j] = document.getElementById("hc_table"+(i+1)).getElementsByClassName("design_radius"+(j+1))[0].value;
                                    sup_ele[j] = document.getElementById("hc_table"+(i+1)).getElementsByClassName("superelevation"+(j+1))[0].value;
                                    // horizontal curve
                                    [sub_s, hc] = wasmTwoLaneHighways.estimate_average_speed(i);
                                    subseg[i][cnt] = subSeg_len[i][j];
                                    sub_S[i][cnt] = sub_s;
                                    HC[i][cnt] = hc;
                                    cnt += 1;
                                    tot_sublen[i] += subSeg_len[i][j];
                                }
                                // var tot_sublen = subSeg_len[i].reduce((a, b) => parseFloat(a) + parseFloat(b), 0);
                                // tangent: rad=0, sup_ele=0, is_hc=false, always last in array
                                if (seg_length > tot_sublen[i]){
                                    is_hc = false;
                                    [sub_s, hc] = wasmTwoLaneHighways.estimate_average_speed(i);
                                    subseg[i][cnt] = seg_length-tot_sublen[i];
                                    sub_S[i][cnt] = sub_s;
                                    HC[i][cnt] = hc;
                                    cnt += 1;
                                    tot_sublen[i] = seg_length;
                                }
                            } else {
                                // No horizontal curve section is treated as one subsection of tangent
                                [sub_s, hc] = wasmTwoLaneHighways.estimate_average_speed(i);
                                subseg[i][0] = seg_length;
                                sub_S[i][0] = sub_s;
                                HC[i][0] = hc;
                                tot_sublen[i] = seg_length;
                            }

                            // Step 6: Estimate percent followers
                            pf[i] = wasmTwoLaneHighways.estimate_percent_followers(i);

                            is_hc = document.getElementById("is_hc"+(i+1)).checked;

                            // Step 7: Calculate passing lane parameters
                            // Step 8: Determine follower density

                            if (pass_type == 'Passing Lane'){
                                // For a PL, this is the FD at the end of the segment (not used for LOS determination)
                                fd[i] = wasmTwoLaneHighways.determine_follower_density_pl(i);
                                PL_idx.push(i);
                                LPL += parseFloat(seg_length);
                            }

                            // Segment output
                            document.getElementById("ffs" + (i+1)).innerHTML = "" + Math.round(ffs*1000)/1000;
                            document.getElementById("pf" + (i+1)).innerHTML = "" + Math.round(pf[i]*1000)/1000;

                        } else {
                            error_flg = 1;
                            error_str = "Missing posted speed limit.";
                        }
                    } else {
                        error_flg = 1;
                        error_str = "Missing values of length and grade."
                    }
                } else {
                    error_flg = 1;
                    error_str = "Failed determining demand flow rates and capacity.";
                }
            } else {
              error_flg = 1;
              error_str = 'Missing posted speed limit.';
            }
        }
        
        // Aggregated Calculation
        if (error_flg == 1) {
            // Must return error message
            out = error_str;
        } else if (error_flg != 1){
            for (let i=0;i<rows_len;i++){
                seg_length = document.getElementById("seg_length"+(i+1)).value;
                Spl = document.getElementById("seg_Spl"+(i+1)).value;
                is_hc = document.getElementById("is_hc"+(i+1)).checked;
                pass_type = document.getElementById("passing_type"+(i+1)).value;

                subrows_len = rows[i].subrows.length;
                var min_dist = 100;
                var cur_dist = 0;
                avg_S = 0;

                // sub_S = Array.from(sub_S, item => item || 0); // replace empty to 0
                if (is_hc == true && subrows_len > 0){
                    for (let j=0; j < cnt; j++){
                      if (sub_S[i][j] == undefined) continue;
                        avg_S += sub_S[i][j] * parseFloat(subseg[i][j]) / tot_sublen[i];
                    }
                } else {
                    // avg_S += sub_S[i][0] * seg_length / tot_len;
                    avg_S = sub_S[i][0];
                }
                // The end of subsegment calculation
                if ((pass_type == 'Passing Constrained') || (pass_type == 'Passing Zone')){
                    fd[i] = wasmTwoLaneHighways.determine_follower_density_pc_pz(i);
                }

                if (PL_idx.length > 0){ // PL should be on the upstream
                    // Step 8.5: Determine effective distance of PL
                    if (i >= PL_idx[0]){
                        // Solve for intermediate values
                        var x2 = 0.1 * Math.max(0, pf[i-1] - 30); // Upstream PF
                        var x3a = 3.5 * Math.log(Math.max(0.3, LPL));
                        var x3b = 0.75 * seg_length;
                        var x4a = 0.01 * demandFlow_v[i];
                        var x4b = 0.005 * demandFlow_v[i];
                        var y1a = 27 + x2 + x3a - x4a;
                        var y2a = 3 + x2 + x3b - x4b;
                        var y3 = 95 * fd[i-1] * avg_S / (pf[i] * demandFlow_v[i]);

                        // Solve for downstream effective length of passing lane from start of PL (LDE)
                        var LDE = Math.exp(y1a / 8.75);
                        if (pass_type == 'Passing Lane'){
                          var PFimprove = Math.max(0, y1a - 8.75 * Math.log(Math.max(0.1, LDE)));
                          var Simprove = Math.max(0, y2a - 0.8 * LDE);
                          var y3 = (100 - PFimprove) / (100 + Simprove);
                        } else {
                          // Step 9: Determine adjustment to follower density
                          for(let j=0;j<PL_idx.length;j++){
                              var pl_idx = PL_idx[j];

                              if(pl_idx < i && cur_dist <= LDE){ // passing lane is at upstream and within effective length
                                  for(let m=i-pl_idx+3;m<=i;m++) cur_dist += parseFloat(seg_len[m]);
                              }
                              if(cur_dist < min_dist) min_dist = cur_dist; // Update closest passing lane

                              // LPL = seg_len[pl_idx]; // Should be LPL[i]
                          }

                          var LD = min_dist; // downstream distance from start of passing lane
                          var x1a = 8.75 * Math.log(Math.max(0.1, LD));
                          var x1b = 0.8 * LD;
                          var x4c = 0.01 * demandFlow_v[i];
                          var x4d = 0.005 * demandFlow_v[i];
                          var y1b = 27 - x1a + x2 + x3a - x4c;
                          var y2b = 3 - x1b + x2 + x3b - x4d;

                          // Solve for FDadj
                          var PFimprove = Math.max(0, y1b);
                          var Simprove = Math.max(0, y2b);
                        }

                        FDadj[i] = pf[i]/100 * (1 - PFimprove/100) * vd / (avg_S * (1 + Simprove/100));
                    } else {
                        FDadj[i] = 0;
                    }
                } else {
                    FDadj[i] = 0;
                }

                // Passing Lane does not consider adjusted follower density
                if (FDadj[i] == 0 || pass_type == 'Passing Lane'){
                    calc_fd[i] = fd[i];
                } else {
                    calc_fd[i] = FDadj[i];
                }

                // Step 10: Determine segment LOS
                segLOS[i] = wasmTwoLaneHighways.determine_segment_los(i, parseInt(Spl), cap[i]);

                // Step 11: Determine facility follower density and LOS
                fdF_num += calc_fd[i] * seg_length;

                // Segment Output -> add table cell
                document.getElementById("avgspd" + (i+1)).innerHTML = "" + Math.round(avg_S*1000) / 1000;
                document.getElementById("fd" + (i+1)).innerHTML = "" + Math.round(calc_fd[i]*1000) / 1000;
                document.getElementById("seglos" + (i+1)).innerHTML = "" + segLOS[i];
            }
            var fdF = fdF_num / tot_len;
            
            var tot_demand = demandFlow_v.reduce((a,b) => parseInt(a) + parseInt(b), 0);
            var tot_cap = cap.reduce((a,b) => a + b, 0);
            LOS = wasmTwoLaneHighways.determine_facility_los(fdF, Spl);
        }

        // Output (LOS)
        document.getElementById("los").innerHTML = "Entire LOS: " + LOS;
        // Facility Follower Density
        document.getElementById("fdF").innerHTML = "Facility Follower Density: " + Math.round(fdF*1000)/1000;
        // Error
        document.getElementById("error").innerHTML = "Error message: " + out;

    }

</script>

<button type="submit" class="btn" on:click={() => callingFunc()}>Calculate</button>
 <!-- on:click={() => submitted = true} -->