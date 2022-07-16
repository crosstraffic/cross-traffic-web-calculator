<script>
import { prefetch } from "$app/navigation";
import { append_dev } from "svelte/internal";

    // Export variables
    export let rows_len;
    export let rows;

    // Main calculation function
    function calculate(rows_len, rows){
        // Initial input variable settings
        var passing_type = [];
        var pass_type = '';
        var vc = 0; // Vertical class
        var rad = 0;
        var sup_ele = 0;
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
        var ver_cls = 0;
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

        // 2D array
        var sub_S = new Array(rows_len); // subsegment speed // --> Causes problem
        var HC = new Array(rows_len); // horizontal class list
        var subSeg_len = new Array(rows_len);


        for (var i=0;i<sub_S.length;i++){
            sub_S[i] = new Array(rows[i].subrows.length+1);
            HC[i] = new Array(rows[i].subrows.length+1);
            subSeg_len[i] = new Array(rows[i].subrows.length+1);
        }

        // Fixed values for the entire segments
        PHF = document.getElementById("PHF_input").value;
        PHV = document.getElementById("PHV_input").value;
        Spl = document.getElementById("Spl_input").value;
        LW = document.getElementById("LW_input").value;
        SW = document.getElementById("SW_input").value;
        APD = document.getElementById("APD_input").value;
        PMHVFL = document.getElementById("PMHVFL_input").value;

        // Error variables
        var error_str = "";
        var error_flg = 0;

        for(let i=0;i<rows_len;i++){
            tot_len += document.getElementById("seg_length"+(i+1)).value;
        }
        // For each Segment
        for(let i=0;i<rows_len;i++){
            var subrows_len = rows[i].subrows.length;
            pass_type = document.getElementById("passing_type"+(i+1)).value;
            vc = document.getElementById("vc_select"+(i+1)).value;
            is_hc = document.getElementById("is_hc"+(i+1)).checked;
            Vi = document.getElementById("vi_input"+(i+1)).value;
            Vo = document.getElementById("vo_input"+(i+1)).value;
            seg_length = document.getElementById("seg_length"+(i+1)).value;
            seg_grade = document.getElementById("seg_grade"+(i+1)).value;


            if(pass_type != "" && pass_type != 'TYPE'){
                passing_type[i] = pass_type;
                // Step 1
                [pass_min, pass_max] = identifyVerticalClass(passing_type[i], vc);

                // out = pass_min.toString() + ',' + pass_max.toString();
                // Step 2: Determine demand flow rates and capacity
                if (Vi != "" && Vo != "" && (PHF != "" && PHF >= 0) && (PHV != "" && PHV >= 0)){
                    [vd, demandFlow_o, capacity] = determineDemandFlow(pass_type, Vi, Vo, vc, PHF, PHV);
                    demandFlow_v[i] = vd;
                    cap[i] = capacity;

                    // Step 3: Determine vertical alignment classification
                    if (seg_length != "" && seg_grade != ""){
                        ver_cls = determineVerticalAlignment(seg_length, seg_grade);

                        if (Spl != "" && (SW != "" && LW != "")){
                            // Step 4: Determine free-flow speed
                            ffs = determineFreeFlowSpeed(Spl, ver_cls, seg_length, demandFlow_o, LW, SW, APD, PHV);

                            // Step 5: Estimate average speed
                            // For each subsegment
                            if (is_hc == true && subrows_len > 0){
                                for (let j=0;j<subrows_len;j++){
                                    subSeg_len[i][j] = document.getElementById("hc_table"+(i+1)).getElementsByClassName("subseg_len"+(j+1))[0].value;
                                    rad = document.getElementById("hc_table"+(i+1)).getElementsByClassName("design_radius"+(j+1))[0].value;
                                    sup_ele = document.getElementById("hc_table"+(i+1)).getElementsByClassName("superelevation"+(j+1))[0].value;
                                    [sub_s, hc] = estimateAverageSpeed(Spl, pass_type, ver_cls, seg_length, ffs, demandFlow_v[i], demandFlow_o, PHV, is_hc, rad, sup_ele);
                                    sub_S[i][j] = sub_s;
                                    HC[i][j] = hc;
                                }
                                var tot_sublen = subSeg_len[i].reduce((a, b) => parseFloat(a) + parseFloat(b), 0);
                                // Tangent part (should not be chosen as subsegment)
                                if (tot_sublen < seg_length){
                                    subSeg_len[i][subrows_len] = seg_length - tot_sublen;
                                    is_hc = false;
                                    [sub_s, hc] = estimateAverageSpeed(Spl, pass_type, ver_cls, seg_length, ffs, demandFlow_v[i], demandFlow_o, PHV, is_hc, rad, sup_ele);
                                    sub_S[i][subrows_len] = sub_s;
                                    HC[i][subrows_len] = hc;
                                }
                            } else {
                                [sub_s, hc] = estimateAverageSpeed(Spl, pass_type, ver_cls, seg_length, ffs, demandFlow_v[i], demandFlow_o, PHV, is_hc, rad, sup_ele);
                                sub_S[i][0] = sub_s;
                                HC[i][0] = hc;
                            }

                            // Step 6: Estimate percent followers
                            pf[i] = estimatePercentFollowers(pass_type, ver_cls, seg_length, ffs, PHV, demandFlow_v[i], demandFlow_o, capacity);

                            is_hc = document.getElementById("is_hc"+(i+1)).checked;

                            // Step 7: Calculate passing lane parameters --> HC?
                            // Step 8: Determine follower density
                            if (is_hc == true && subrows_len > 0){ // if nothing inside of subrows, it returns error
                                for (let j=0;j<subrows_len;j++){
                                    subSeg_len[i][j] = document.getElementById("hc_table"+(i+1)).getElementsByClassName("subseg_len"+(j+1))[0].value;
                                    rad = document.getElementById("hc_table"+(i+1)).getElementsByClassName("design_radius"+(j+1))[0].value;
                                    sup_ele = document.getElementById("hc_table"+(i+1)).getElementsByClassName("superelevation"+(j+1))[0].value;
                                    if (pass_type == 'Passing Lane'){
                                        fd[i][j] = determineFollowerDensityPL(pass_type, demandFlow_v[i], PHV, PMHVFL, Spl, ver_cls, HC[i][j], seg_length, ffs, demandFlow_o, is_hc, capacity, rad, sup_ele);
                                        PL_idx[i] = i;
                                    }
                                    var tot_sublen = subSeg_len[i].reduce((a, b) => parseFloat(a) + parseFloat(b), 0);
                                    // Tangent part (should not be chosen as subsegment)
                                    if (tot_sublen < seg_length){
                                        subSeg_len[i][subrows_len] = seg_length - tot_sublen;
                                        is_hc = false;
                                        fd[i][subrows_len] = determineFollowerDensityPL(pass_type, demandFlow_v[i], PHV, PMHVFL, Spl, ver_cls, HC[i][subrows_len], seg_length, ffs, demandFlow_o, is_hc, capacity, rad, sup_ele);
                                        PL_idx[i] = i;
                                    }
                                }
                            } else {
                                if (pass_type == 'Passing Lane'){
                                    fd[i][0] = determineFollowerDensityPL(pass_type, demandFlow_v[i], PHV, PMHVFL, Spl, ver_cls, HC[i][0], seg_length, ffs, demandFlow_o, is_hc, capacity, rad, sup_ele);
                                    PL_idx[i] = i;
                                }
                            }

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
                is_hc = document.getElementById("is_hc"+(i+1)).checked;
                pass_type = document.getElementById("passing_type"+(i+1)).value;

                var min_dist = 0;
                var cur_dist = 0;
                var LPL = 0;
                console.log(sub_S);
                console.log(subSeg_len);
                console.log(tot_len);

                if (is_hc == true && subrows_len > 0){
                    for (let j=0;j<subrows_len;j++){
                        avg_S += sub_S[i][j] * parseFloat(subSeg_len[i][j]) / tot_len;
                    }
                } else {
                    avg_S += sub_S[i][0] * seg_length / tot_len;
                }
                // The end of subsegment calculation

                if ((pass_type == 'Passing Constrained') || (pass_type == 'Passing Zone')){
                    fd[i] = determineFollowerDensityPCPZ(pf[i], demandFlow_v[i], avg_S);
                }

                if (PL_idx.length > 0){

                    // Step 8.5: Determine effective distance of PL
                    if (i > 0){
                        // Solve for intermediate values
                        var x2 = 0.1 * Math.max(0, pf[i-1] - 30);
                        var x3a = 3.5 * Math.log(Math.max(0.3, seg_length));
                        var x3b = 0.75 * seg_length;
                        var x4a = 0.01 * demandFlow_v[i-1];
                        var x4b = 0.005 * demandFlow_v[i-1];
                        var y1a = 27 + x2 + x3a - x4a;
                        var y2a = 3 + x2 + x3b - x4b;
                        var y3 = 95 * fd[i-1] * avg_S / (pf[i-1] * demandFlow_v[i-1]);

                        // Solve for downstream effective length of passing lane from start of PL (LDE)
                        var LDE = Math.exp(y1a / 8.75);
                        var PFimprove = Math.max(0, y1a - 8.75 * Math.log(Math.max(0.1, LDE)));
                        var Simprove = Math.max(0, y2a - 0.8 * LDE);
                        var y3 = (100 - PFimprove) / (100 + Simprove);

                        // Step 9: Determine adjustment to follower density
                        for(let j=0;j<PL_idx.length;j++){
                            var pl_idx = PL_idx[j];

                            if(pl_idx > i && cur_dist <= LDE){ // passing lane is at downstream and within effective length
                                for(let m=i;m<pl_idx-i;m++) cur_dist += seg_len[m];
                            }
                            if(cur_dist < min_dist) min_dist = cur_dist; // Update closest passing lane

                            LPL = seg_len[pl_idx]; // Should be LPL[i]
                        }

                        var LD = min_dist; // downstream distance from start of passing lane
                        var x1a = 8.75 * Math.log(Math.max(0.1, LD));
                        var x1b = 0.8 * LD;
                        var x4c = 0.01 * demandFlow_v[i];
                        var x4d = 0.005 * demandFlow_v[i];
                        var y1b = 27 - x1a + x2 + x3a - x4c;
                        var y2b = 3 - x1b + x2 + x3b - x4d;

                        // Solve for FDadj
                        PFimprove = Math.max(0, y1b);
                        Simprove = Math.max(0, y2b);
                        FDadj[i] = pf[i]/100 * (1 - PFimprove/100) * vd / (avg_S * (1 + Simprove/100));
                    } else {
                        FDadj[i] = 0;
                    }
                } else {
                    FDadj[i] = 0;
                }
                 
                if (FDadj[i] == 0){
                    calc_fd[i] = fd[i];
                } else {
                    calc_fd[i] = FDadj[i];
                }
                // Step 10: Determine segment LOS
                segLOS[i] = determineSegmentLOS(calc_fd[i], parseInt(Spl), demandFlow_v[i], cap[i]);

                // Step 11: Determine facility follower density and LOS
                // fdF_num += calc_fd[i] * seg_len[i];
                fdF_num += calc_fd[i] * seg_length;

            }
            console.log(calc_fd);
            var fdF = fdF_num / tot_len;
            var tot_demand = demandFlow_v.reduce((a,b) => parseInt(a) + parseInt(b), 0);
            var tot_cap = cap.reduce((a,b) => a + b, 0);
            console.log(fdF_num);
            LOS = determineSegmentLOS(fdF, Spl, tot_demand, tot_cap);
        }

        // Output 
        document.getElementById("los").innerHTML = "Each Segment LOS: " + segLOS + ", Entire LOS: " + LOS;
        // Error
        document.getElementById("error").innerHTML = "Error message: " + out;

    }


  function identifyVerticalClass(PT, vc) {
    // Identify Facility Study Boundaries and Corresponding Segmentation

    var _min = 0;
    var _max = 0;

    if (vc == 1 && PT == 'Passing Constrained') {
      _min = 0.25;
      _max = 3.0;
    } else if (vc == 1 && PT == 'Passing Zone') {
      _min = 0.25;
      _max = 2.0;
    } else if (vc == 1 && PT == 'Passing Lane') {
      _min = 0.5;
      _max = 3.0;
    } else if (vc == 2 && PT == 'Passing Constrained') {
      _min = 0.25;
      _max = 3.0;
    } else if (vc == 2 && PT == 'Passing Zone') {
      _min = 0.25;
      _max = 2.0;
    } else if (vc == 2 && PT == 'Passing Lane') {
      _min = 0.5;
      _max = 3.0;
    } else if (vc == 3 && PT == 'Passing Constrained') {
      _min = 0.25;
      _max = 1.1;
    } else if (vc == 3 && PT == 'Passing Zone') {
      _min = 0.25;
      _max = 1.1;
    } else if (vc == 3 && PT == 'Passing Lane') {
      _min = 0.5;
      _max = 1.1;
    } else if (vc == 4 && PT == 'Passing Constrained') {
      _min = 0.5;
      _max = 3.0;
    } else if (vc == 4 && PT == 'Passing Zone') {
      _min = 0.5;
      _max = 2.0;
    } else if (vc == 4 && PT == 'Passing Lane') {
      _min = 0.5;
      _max = 3.0;
    } else if (vc == 5 && PT == 'Passing Constrained') {
      _min = 0.5;
      _max = 3.0;
    } else if (vc == 5 && PT == 'Passing Zone') {
      _min = 0.5;
      _max = 2.0;
    } else if (vc == 5 && PT == 'Passing Lane') {
      _min = 0.5;
      _max = 3.0;
    }

    return [_min, _max];
  }

  function determineDemandFlow(PT, Vi, Vo, vc, PHF, HV) {
    var demandFlow_i = Vi / PHF;
    var demandFlow_o = 0;
    var capacity = 0;

    if (PT == 'Passing Zone' && Vo == '') {
      console.log('Vo must be given for PZ segments');
      capacity = 1700;
    } else if (PT == 'Passing Zone') {
      demandFlow_o = Vo / PHF;
      capacity = 1700;
    } else if (PT == 'Passing Constrained') {
      demandFlow_o = 1500;
      capacity = 1700;
    } else if (PT == 'Passing Lane') {
      if (HV < 5) {
        capacity = 1500;
      } else if (HV >= 5 && HV < 10) {
        if (vc == 5) {
          capacity = 1400;
        } else {
          capacity = 1500;
        }
      } else if (HV >= 10 && HV < 15) {
        if (vc == 1 || vc == 2 || vc == 3) {
          capacity = 1400;
        } else {
          capacity = 1300;
        }
      } else if (hv >= 15 && hv < 20) {
        if (vc == 1 || vc == 2 || vc == 3 || vc == 4) {
          capacity = 1300;
        } else {
          capacity = 1200;
        }
      } else if (HV >= 20 && HV < 25) {
        if (vc == 1 || vc == 2 || vc == 3) {
          capacity = 1300;
        } else if (vc == 4) {
          capacity = 1200;
        } else {
          capacity = 1100;
        }
      } else if (HV >= 25) {
        capacity = 1100;
      }
    }

    return [demandFlow_i, demandFlow_o, capacity];
  }

  function determineVerticalAlignment(seg_length, seg_grade) {
    var ver_align = 0;
    if (seg_grade >= 0) {
      if (seg_length <= 0.1) {
        if (seg_grade <= 7) ver_align = 1;
        else ver_align = 2;
      } else if (seg_length > 0.1 && seg_length <= 0.2) {
        if (seg_grade <= 4) ver_align = 1;
        else if (seg_grade <= 7) ver_align = 2;
        else ver_align = 3;
      } else if (seg_length > 0.2 && seg_length <= 0.3) {
        if (seg_grade <= 3) ver_align = 1;
        else if (seg_grade <= 5) ver_align = 2;
        else if (seg_grade <= 7) ver_align = 3;
        else if (seg_grade <= 7) ver_align = 4;
        else ver_align = 5;
      } else if (seg_length > 0.3 && seg_length <= 0.4) {
        if (seg_grade <= 2) ver_align = 1;
        else if (seg_grade <= 4) ver_align = 2;
        else if (seg_grade <= 6) ver_align = 3;
        else if (seg_grade <= 7) ver_align = 4;
        else ver_align = 5;
      } else if (seg_length > 0.4 && seg_length <= 0.5) {
        if (seg_grade <= 2) ver_align = 1;
        else if (seg_grade <= 4) ver_align = 2;
        else if (seg_grade <= 5) ver_align = 3;
        else if (seg_grade <= 6) ver_align = 4;
        else ver_align = 5;
      } else if (seg_length > 0.5 && seg_length <= 0.6) {
        if (seg_grade <= 2) ver_align = 1;
        else if (seg_grade <= 3) ver_align = 2;
        else if (seg_grade <= 5) ver_align = 3;
        else if (seg_grade <= 6) ver_align = 4;
        else ver_align = 5;
      } else if (seg_length > 0.6 && seg_length <= 0.7) {
        if (seg_grade <= 2) ver_align = 1;
        else if (seg_grade <= 3) ver_align = 2;
        else if (seg_grade <= 4) ver_align = 3;
        else if (seg_grade <= 6) ver_align = 4;
        else ver_align = 5;
      } else if (seg_length > 0.8 && seg_length <= 1.1) {
        if (seg_grade <= 2) ver_align = 1;
        else if (seg_grade <= 3) ver_align = 2;
        else if (seg_grade <= 4) ver_align = 3;
        else if (seg_grade <= 5) ver_align = 4;
        else ver_align = 5;
      } else {
        if (seg_grade <= 2) ver_align = 1;
        else if (seg_grade <= 3) ver_align = 2;
        else if (seg_grade <= 5) ver_align = 4;
        else ver_align = 5;
      }
    } else {
      seg_length = -1 * seg_length;
      if (seg_length <= 0.1) {
        if (seg_grade <= 8) ver_align = 1;
        else ver_align = 2;
      } else if (seg_length > 0.1 && seg_length <= 0.2) {
        if (seg_grade <= 5) ver_align = 1;
        else if (seg_grade <= 8) ver_align = 2;
        else ver_align = 3;
      } else if (seg_length > 0.2 && seg_length <= 0.3) {
        if (seg_grade <= 4) ver_align = 1;
        else if (seg_grade <= 6) ver_align = 2;
        else if (seg_grade <= 8) ver_align = 3;
        else if (seg_grade <= 9) ver_align = 4;
        else ver_align = 5;
      } else if (seg_length > 0.3 && seg_length <= 0.4) {
        if (seg_grade <= 2) ver_align = 1;
        else if (seg_grade <= 5) ver_align = 2;
        else if (seg_grade <= 6) ver_align = 3;
        else if (seg_grade <= 8) ver_align = 4;
        else ver_align = 5;
      } else if (seg_length > 0.4 && seg_length <= 0.5) {
        if (seg_grade <= 3) ver_align = 1;
        else if (seg_grade <= 4) ver_align = 2;
        else if (seg_grade <= 6) ver_align = 3;
        else if (seg_grade <= 7) ver_align = 4;
        else ver_align = 5;
      } else if (seg_length > 0.5 && seg_length <= 0.7) {
        if (seg_grade <= 3) ver_align = 1;
        else if (seg_grade <= 4) ver_align = 2;
        else if (seg_grade <= 5) ver_align = 3;
        else if (seg_grade <= 6) ver_align = 4;
        else ver_align = 5;
      } else if (seg_length > 0.7 && seg_length <= 0.8) {
        if (seg_grade <= 3) ver_align = 1;
        else if (seg_grade <= 4) ver_align = 3;
        else if (seg_grade <= 6) ver_align = 4;
        else ver_align = 5;
      } else if (seg_length > 0.8 && seg_length <= 0.9) {
        if (seg_grade <= 3) ver_align = 1;
        else if (seg_grade <= 4) ver_align = 3;
        else if (seg_grade <= 5) ver_align = 4;
        else ver_align = 5;
      } else if (seg_length > 0.9 && seg_length <= 1.1) {
        if (seg_grade <= 2) ver_align = 1;
        else if (seg_grade <= 3) ver_align = 2;
        else if (seg_grade <= 4) ver_align = 3;
        else if (seg_grade <= 5) ver_align = 4;
        else ver_align = 5;
      } else {
        if (seg_grade <= 2) ver_align = 1;
        else if (seg_grade <= 3) ver_align = 2;
        else if (seg_grade <= 5) ver_align = 4;
        else ver_align = 5;
      }
    }

    return ver_align;
  }

  function determineFreeFlowSpeed(Spl, ver_cls, seg_length, vo, LW, SW, APD, PHV) {
    var bffs = 1.14 * Spl;
    var a0 = 0.0;
    var a1 = 0.0;
    var a2 = 0.0;
    var a3 = 0.0;
    var a4 = 0.0;
    var a5 = 0.0;

    if (ver_cls == 1) {
      a0 = 0.0;
      a1 = 0.0;
      a2 = 0.0;
      a3 = 0.0;
      a4 = 0.0;
      a5 = 0.0;
    } else if (ver_cls == 2) {
      a0 = -0.45036;
      a1 = 0.00814;
      a2 = 0.01543;
      a3 = 0.01358;
      a4 = 0.0;
      a5 = 0.0;
    } else if (ver_cls == 3) {
      a0 = -0.29591;
      a1 = 0.00743;
      a2 = 0.0;
      a3 = 0.01246;
      a4 = 0.0;
      a5 = 0.0;
    } else if (ver_cls == 4) {
      a0 = -0.40902;
      a1 = 0.00975;
      a2 = 0.00767;
      a3 = -0.18363;
      a4 = 0.00423;
      a5 = 0.0;
    } else if (ver_cls == 5) {
      a0 = -0.3836;
      a1 = 0.01074;
      a2 = 0.01945;
      a3 = -0.69848;
      a4 = 0.01069;
      a5 = 0.127;
    }

    var a = Math.max(
      0.0333,
      a0 + a1 * bffs + a2 * seg_length + (Math.max(0, a3 + a4 * bffs + a5 * seg_length) * vo) / 1000,
    );
    var fLS = 0.6 * (12 - LW) + 0.7 * (6 - SW);
    var fA = Math.min(APD / 4, 10);

    var ffs = bffs - a * PHV - fLS - fA;

    return ffs;
  }

    function estimateAverageSpeed(Spl, pass_type, ver_cls, seg_length, ffs, vd, vo, PHV, is_hc, rad, sup_ele){
        var bffs = 1.14 * Spl;
        var b0 = 0.0000;
        var b1 = 0.0000;
        var b2 = 0.0000;
        var b3 = 0.0000;
        var b4 = 0.0000;
        var b5 = 0.0000;
        var c0 = 0.0000;
        var c1 = 0.0000;
        var c2 = 0.0000;
        var c3 = 0.0000;
        var d0 = 0.0000;
        var d1 = 0.0000;
        var d2 = 0.0000;
        var d3 = 0.0000;
        var f0 = 0.0000;
        var f1 = 0.0000;
        var f2 = 0.0000;
        var f3 = 0.0000;
        var f4 = 0.0000;
        var f5 = 0.0000;
        var f6 = 0.0000;
        var f7 = 0.0000;
        var f8 = 0.0000;
        var S = 0;
        var hor_cls = 0;

        if (pass_type == 'Passing Constrained' || pass_type == 'Passing Zone'){
            if (ver_cls == 1){
                b0 = 0.0558;
                b1 = 0.0542;
                b2 = 0.3278;
                b3 = 0.1029;
                f0 = 0.67576;
                f3 = 0.12060;
                f4 = -0.35919;
            } else if (ver_cls == 2){
                b0 = 5.7280;
                b1 = -0.0809;
                b2 = 0.7404;
                b5 = 3.1155;
                c0 = -13.8036;
                c2 = 0.2446;
                d0 = -1.7765;
                d2 = 0.0392;
                b3 = c0 + c1 * Math.sqrt(seg_length) + c2 * ffs + c3 * ffs * Math.sqrt(seg_length);
                b4 = d0 + d1 * Math.sqrt(PHV) + d2 * ffs + d3 * ffs * Math.sqrt(PHV);
                f0 = 0.34524;
                f1 = 0.00591;
                f2 = 0.02031;
                f3 = 0.14911;
                f4 = -0.43784;
                f5 = -0.00296;
                f6 = 0.02956;
                f8 = 0.41622;
            } else if (ver_cls == 3){
                b0 = 9.3079;
                b1 = -0.1706;
                b2 = 1.1292;
                b5 = 3.1155;
                c0 = -11.9703;
                c2 = 0.2542;
                d0 = -3.5550;
                d2 = 0.0826;
                b3 = c0 + c1 * Math.sqrt(seg_length) + c2 * ffs + c3 * ffs * Math.sqrt(seg_length);
                b4 = d0 + d1 * Math.sqrt(PHV) + d2 * ffs + d3 * ffs * Math.sqrt(PHV);
                f0 = 0.17291;
                f1 = 0.00917;
                f2 = 0.05698;
                f3 = 0.27734;
                f4 = -0.61893;
                f5 = -0.00918;
                f6 = 0.09184;
                f8 = 0.41622;
            } else if (ver_cls == 4){
                b0 = 9.0115;
                b1 = -0.1994;
                b2 = 1.8252;
                b5 = 3.2685;
                c0 = -12.5113;
                c2 = 0.2656;
                d0 = -5.7775;
                d2 = 0.1373;
                b3 = c0 + c1 * Math.sqrt(seg_length) + c2 * ffs + c3 * ffs * Math.sqrt(seg_length);
                b4 = d0 + d1 * Math.sqrt(PHV) + d2 * ffs + d3 * ffs * Math.sqrt(PHV);
                f0 = 0.67689;
                f1 = 0.00534;
                f2 = -0.13037;
                f3 = 0.25699;
                f4 = -0.68465;
                f5 = -0.00709;
                f6 = 0.07087;
                f8 = 0.33950;
            } else if (ver_cls == 5){
                b0 = 23.9144;
                b1 = -0.6925;
                b2 = 1.9473;
                b5 = 3.5115;
                c0 = -14.8961;
                c2 = 0.4370;
                d0 = -18.2910;
                d1 = 2.3875;
                d2 = 0.4494;
                d3 = -0.0520;
                b3 = c0 + c1 * Math.sqrt(seg_length) + c2 * ffs + c3 * ffs * Math.sqrt(seg_length);
                b4 = d0 + d1 * Math.sqrt(PHV) + d2 * ffs + d3 * ffs * Math.sqrt(PHV);
                f0 = 1.13262;
                f2 = -0.26367;
                f3 = 0.18811;
                f4 = -0.64304;
                f5 = -0.00867;
                f6 = 0.08675;
                f8 = 0.30590;
            }
        } else if (pass_type == 'Passing Lane'){
            if (ver_cls == 1){
                b0 = -1.1379;
                b1 = 0.0941;
                c1 = 0.2667;
                d1 = 0.1252;
                b3 = c0 + c1 * Math.sqrt(seg_length) + c2 * ffs + c3 * ffs * Math.sqrt(seg_length);
                b4 = d0 + d1 * Math.sqrt(PHV) + d2 * ffs + d3 * ffs * Math.sqrt(PHV);
                f0 = 0.91793;
                f1 = -0.00557;
                f2 = 0.36862;
                f5 = 0.00611;
                f7 = -0.00419;
            } else if (ver_cls == 2){
                b0 = -2.0668;
                b1 = 0.1053;
                c1 = 0.4479;
                d1 = 0.1631;
                b3 = c0 + c1 * Math.sqrt(seg_length) + c2 * ffs + c3 * ffs * Math.sqrt(seg_length);
                b4 = d0 + d1 * Math.sqrt(PHV) + d2 * ffs + d3 * ffs * Math.sqrt(PHV);
                f0 = 0.65105;
                f2 = 0.34931;
                f5 = 0.00722;
                f7 = -0.00391;
            } else if (ver_cls == 3){
                b0 = -0.5074;
                b1 = 0.0935;
                d1 = -0.2201;
                d3 = 0.0072;
                b4 = d0 + d1 * Math.sqrt(PHV) + d2 * ffs + d3 * ffs * Math.sqrt(PHV);
                f0 = 0.40117;
                f2 = 0.68633;
                f5 = 0.02350;
                f7 = -0.02088;
            } else if (ver_cls == 4){
                b0 = 8.0354;
                b1 = -0.0860;
                b5 = 4.1900;
                c0 = -27.1244;
                c1 = 11.5196;
                c2 = 0.4681;
                c3 = -0.1873;
                d1 = -0.7506;
                d3 = 0.0193;
                b3 = c0 + c1 * Math.sqrt(seg_length) + c2 * ffs + c3 * ffs * Math.sqrt(seg_length);
                b4 = d0 + d1 * Math.sqrt(PHV) + d2 * ffs + d3 * ffs * Math.sqrt(PHV);
                f0 = 1.13282;
                f1 = -0.00798;
                f2 = 0.35425;
                f5 = 0.01521;
                f7 = -0.00987;
            } else if (ver_cls == 5){
                b0 = 7.2991;
                b1 = -0.3535;
                b5 = 4.8700;
                c0 = -45.3391;
                c1 = 17.3749;
                c2 = 1.0587;
                c3 = -0.3729;
                d0 = 3.8457;
                d1 = -0.9112;
                d3 = 0.0170;
                b3 = c0 + c1 * Math.sqrt(seg_length) + c2 * ffs + c3 * ffs * Math.sqrt(seg_length);
                b4 = d0 + d1 * Math.sqrt(PHV) + d2 * ffs + d3 * ffs * Math.sqrt(PHV);
                f0 = 1.12077;
                f1 = -0.00550;
                f2 = 0.25431;
                f5 = 0.01269;
                f7 = -0.01053;
            }
        }
    // slope coefficient for average speed calculation
    var ms = Math.max(
      b5,
      b0 +
        b1 * ffs +
        b2 * Math.sqrt(vo / 1000) +
        Math.max(0, b3) * Math.sqrt(seg_length) +
        Math.max(0, b4) * Math.sqrt(PHV),
    );
    // power coefficient for average speed calculation
    var ps = Math.max(
      f8,
      f0 +
        f1 * ffs +
        f2 * seg_length +
        (f3 * vo) / 1000 +
        f4 * Math.sqrt(vo / 1000) +
        f5 * PHV +
        f6 * Math.sqrt(PHV) +
        f7 * seg_length * PHV,
    );
    // determine horizontal class
    if (rad < 300){
        hor_cls = 5;
    } else if (rad >= 300 && rad < 450){
        hor_cls = 4;
    } else if (rad >= 450 && rad < 600){
        if (sup_ele < 1) hor_cls = 4;
        else hor_cls = 3;
    } else if (rad >= 600 && rad < 750){
        if (sup_ele < 6) hor_cls = 3;
        else hor_cls = 2;
    } else if (rad >= 750 && rad < 900){
        hor_cls = 2;
    } else if (rad >= 900 && rad < 1050){
        if(sup_ele < 8) hor_cls = 2;
        else hor_cls = 1;
    } else if (rad >= 1050 && rad < 1200){
        if(sup_ele < 4) hor_cls = 2;
        else hor_cls = 1;
    } else if (rad >= 1200 && rad < 1350){
        if(sup_ele < 2) hor_cls = 2;
        else hor_cls = 1;
    } else if (rad >= 1350 && rad < 1500){
        hor_cls = 1;
    } else if (rad >= 1500 && rad < 1750){
        if (sup_ele < 8) hor_cls = 1;
        else hor_cls = 0;
    } else if (rad >= 1750 && rad < 1800){
        if (sup_ele < 6) hor_cls = 1;
        else hor_cls = 0;
    } else if (rad >= 1800 && rad < 1950){
        if (sup_ele < 5) hor_cls = 1;
        else hor_cls = 0;
    } else if (rad >= 1950 && rad < 2100){
        if (sup_ele < 4) hor_cls = 1;
        else hor_cls = 0;
    } else if (rad >= 2100 && rad < 2250){
        if (sup_ele < 3) hor_cls = 1;
        else hor_cls = 0;
    } else if (rad >= 2250 && rad < 2400){
        if (sup_ele < 2) hor_cls = 1;
        else hor_cls = 0;
    } else if (rad >= 2400 && rad < 2550){
        if (sup_ele < 1) hor_cls = 1;
        else hor_cls = 0;
    } else if (rad >= 2550){
        hor_cls = 0;
    }

    if (vd <= 100) {
      var ST = ffs;
      S = ST;
    } else {
      var ST = (ffs - ms * (vd / 1000 - 0.1)) ^ ps;
      S = ST;
    }

    if (hor_cls = 0) is_hc = false; // treat curve as tanget section

    if (is_hc == true){
        // calculate horizontal class
        var bffshc = Math.min(bffs, 44.32 + 0.3728 * bffs - 6.868 * hor_cls);
        var ffshc = bffshc - 2.55 * PHV
        var mhc = Math.max(0.277, -25.8993 - 0.7756 * ffshc + 10.6294 * Math.sqrt(ffshc) + 2.4766 * hor_cls - 9.8238 * Math.sqrt(hor_cls));
        var shc = Math.min(ST, ffshc - mhc * Math.sqrt(vd/1000 - 0.1));
        S = shc;
    }

    return [S, hor_cls];
  }

    function estimatePercentFollowers(pass_type, ver_cls, seg_length, ffs, phv, vd, vo, cap){
        var b0 = 0.00000;
        var b1 = 0.00000;
        var b2 = 0.00000;
        var b3 = 0.00000;
        var b4 = 0.00000;
        var b5 = 0.00000;
        var b6 = 0.00000;
        var b7 = 0.00000;
        var c0 = 0.00000;
        var c1 = 0.00000;
        var c2 = 0.00000;
        var c3 = 0.00000;
        var c4 = 0.00000;
        var c5 = 0.00000;
        var c6 = 0.00000;
        var c7 = 0.00000;
        var d1 = 0.00000;
        var d2 = 0.00000;
        var e0 = 0.00000;
        var e1 = 0.00000;
        var e2 = 0.00000;
        var e3 = 0.00000;
        var e4 = 0.00000;

        var PFcap = 0;
        var PF25cap = 0;

        if (pass_type == 'Passing Constrained' || pass_type == 'Passing Zone'){
            if (ver_cls == 1){
                b0 = 37.68080;
                b1 = 3.05089;
                b2 = -7.90866;
                b3 = -0.94321;
                b4 = 13.53266;
                b5 = -0.00050;
                b6 = -0.05500;
                b7 = 7.13758;
                c0 = 18.01780;
                c1 = 10.00000;
                c2 = -21.60000;
                c3 = -0.97853;
                c4 = 12.05214;
                c5 = -0.00750;
                c6 = -0.06700;
                c7 = 11.60405;
            }else if (ver_cls == 2){
                b0 = 58.21104;
                b1 = 5.73387;
                b2 = -13.66293;
                b3 = -0.66126;
                b4 = 9.08575;
                b5 = -0.00950;
                b6 = -0.03602;
                b7 = 7.14619;
                c0 = 47.83887;
                c1 = 12.80000;
                c2 = -28.20000;
                c3 = -0.61758;
                c4 = 5.80000;
                c5 = -0.04550;
                c6 = -0.03344;
                c7 = 11.35573;
            }else if (ver_cls == 3){
                b0 = 113.20439;
                b1 = 10.01778;
                b2 = -18.90000;
                b3 = 0.46542;
                b4 = -6.75338;
                b5 = -0.03000;
                b6 = -0.05800;
                b7 = 10.03239;
                c0 = 125.40000;
                c1 = 19.50000;
                c2 = -34.90000;
                c3 = 0.90672;
                c4 = -16.10000;
                c5 = -0.11000;
                c6 = -0.06200;
                c7 = 14.71136;
            }else if (ver_cls == 4){
                b0 = 58.29978;
                b1 = -0.53611;
                b2 = 7.35076;
                b3 = -0.27046;
                b4 = 4.49850;
                b5 = -0.01100;
                b6 = -0.02968;
                b7 = 8.89680;
                c0 = 103.13534;
                c1 = 14.68459;
                c2 = -23.72704;
                c3 = 0.66444;
                c4 = -11.95763;
                c5 = -0.10000;
                c6 = 0.00172;
                c7 = 14.56611;
            }else if (ver_cls == 5){
                b0 = 3.32968;
                b1 = -0.84377;
                b2 = 7.08952;
                b3 = -1.32089;
                b4 = 19.98477;
                b5 = -0.01250;
                b6 = -0.02960;
                b7 = 9.99453;
                c0 = 89.00000;
                c1 = 19.02642;
                c2 = -34.54240;
                c3 = 0.29792;
                c4 = -6.62528;
                c5 = -0.16000;
                c6 = 0.00480;
                c7 = 17.56611;
            }
            d1 = -0.29764;
            d2 = -0.71917;
            e0 = 0.81165;
            e1 = 0.37920;
            e2 = -0.49524;
            e3 = -2.11289;
            e4 = 2.41146;

            PFcap = b0 + b1 * seg_length + b2 * Math.sqrt(seg_length) + b3 * ffs + b4 * Math.sqrt(ffs) + b5 * phv + b6 * ffs * vo / 1000 + b7 * Math.sqrt(vo/1000);
            PF25cap = c0 + c1 * seg_length + c2 * Math.sqrt(seg_length) + c3 * ffs + c4 * Math.sqrt(ffs) + c5 * phv + c6 * ffs * vo / 1000 + c7 * Math.sqrt(vo/1000);
        } else if (pass_type == 'Passing Lane'){
            if (ver_cls == 1){
                b0 = 61.73075;
                b1 = 6.73922;
                b2 = -23.68853;
                b3 = -0.84126;
                b4 = 11.44533;
                b5 = -1.05124;
                b6 = 1.50390;
                b7 = 0.00491;
                c0 = 80.37105;
                c1 = 14.44997;
                c2 = -46.41831;
                c3 = -0.23367;
                c4 = 0.84914;
                c5 = -0.56747;
                c6 = 0.89427;
                c7 = 0.00119;
            }else if (ver_cls == 2){
                b0 = 12.30096;
                b1 = 9.57465;
                b2 = -30.79427;
                b3 = -1.79448;
                b4 = 25.76436;
                b5 = -0.66350;
                b6 = 1.26039;
                b7 = -0.00323;
                c0 = 18.37886;
                c1 = 14.71856;
                c2 = -47.78892;
                c3 = -1.43373;
                c4 = 18.32040;
                c5 = -0.13226;
                c6 = 0.77127;
                c7 = -0.00778;
            }else if (ver_cls == 3){
                b0 = 206.07369;
                b1 = -4.29885;
                b2 = 0.00000;
                b3 = 1.96483;
                b4 = -30.32556;
                b5 = -0.75812;
                b6 = 1.06453;
                b7 = -0.00839;
                c0 = 239.98930;
                c1 = 15.90683;
                c2 = -46.87525;
                c3 = 2.73582;
                c4 = -42.88130;
                c5 = -0.53746;
                c6 = -0.76271;
                c7 = -0.00428;
            }else if (ver_cls == 4){
                b0 = 263.13428;
                b1 = 5.38749;
                b2 = -19.04859;
                b3 = 2.73018;
                b4 = -42.76919;
                b5 = -1.31277;
                b6 = -0.32242;
                b7 = 0.01412;
                c0 = 223.68435;
                c1 = 10.26908;
                c2 = -35.60830;
                c3 = 2.31877;
                c4 = -38.30034;
                c5 = -0.60275;
                c6 = -0.67758;
                c7 = 0.00117;
            }else if (ver_cls == 5){
                b0 = 126.95629;
                b1 = 5.95754;
                b2 = -19.22229;
                b3 = 0.43238;
                b4 = -7.35636;
                b5 = -1.03017;
                b6 = -2.66026;
                b7 = 0.01389;
                c0 = 137.37633;
                c1 = 11.00106;
                c2 = -38.89043;
                c3 = 0.78501;
                c4 = -14.88672;
                c5 = -0.72576;
                c6 = -2.49546;
                c7 = 0.00872;
            }
            d1 = -0.15808;
            d2 = -0.83732;
            e0 = -1.63246;
            e1 = 1.64960;
            e2 = -4.45823;
            e3 = -4.89119;
            e4 = 10.33057;

            PFcap = b0 + b1 * seg_length + b2 * Math.sqrt(seg_length) + b3 * ffs + b4 * Math.sqrt(ffs) + b5 * phv + b6 * Math.sqrt(phv) + b7 * ffs * phv;
            PF25cap = c0 + c1 * seg_length + c2 * Math.sqrt(seg_length) + c3 * ffs + c4 * Math.sqrt(ffs) + c5 * phv + c6 * Math.sqrt(phv) + c7 * ffs * phv;
        }

    var zcap = (0 - Math.log(1 - PFcap / 100)) / (cap / 1000);
    var z25cap = (0 - Math.log(1 - PF25cap / 100)) / ((0.25 * cap) / 1000);

    var mPF = d1 * z25cap + d2 * zcap;
    var pPF = e0 + e1 * z25cap + e2 * zcap + e3 * Math.sqrt(z25cap) + e4 * Math.sqrt(zcap);

    var PF = 100 * (1 - Math.exp((mPF * (vd / 1000)) ^ pPF));

    return PF;
  }
    function determineFollowerDensityPL(pass_type, vd, PHV, PMHVFL, Spl, ver_cls, hc, seg_length, ffs, vo, is_hc, capacity, rad, sup_ele){

        var SinitFL = 0;
        var pfFL = 0;
        var SinitSL = 0;
        var pfSL = 0;
        var hor_cls = 0;
        
        // Calculate passing lane parameters
        var NHV = vd * PHV / 100;
        var PvFL = 0.92183 - 0.05022 * Math.log(vd) - 0.00030 * NHV;
        var vdFL = vd * PvFL;
        var vdSL = vd * (1 - PvFL);
        var PHVFL = PHV * PMHVFL;
        var NHVSL = NHV - (vdFL * PHVFL)
        var PHVSL = NHVSL / vdSL;
        [SinitFL, hor_cls] = estimateAverageSpeed(Spl, pass_type, ver_cls, seg_length, ffs, vdFL, vo, PHVFL, is_hc, rad, sup_ele);
        pfFL = estimatePercentFollowers(pass_type, ver_cls, seg_length, ffs, PHVFL, vdFL, vo, capacity);

        [SinitSL, hor_cls] = estimateAverageSpeed(Spl, pass_type, ver_cls, seg_length, ffs, vdSL, vo, PHVSL, is_hc, rad, sup_ele);
        pfSL = estimatePercentFollowers(pass_type, ver_cls, seg_length, ffs, PHVSL, vdSL, vo, capacity);

        var SDA = 2.750 + 0.00056 * vd + 3.8521 * PHV;
        var SmidFL = SinitFL + SDA / 2;
        var SmidSL = SinitSL - SDA / 2;

        // it's acutually fd at the midpoint of the PL segment but used for LOS calculation
        var FDmid = (pfFL * vdFL / SmidFL + pfSL * vdSL / SmidSL) / 200 ;

        return FDmid;
    }

  function determineFollowerDensityPCPZ(PF, vd, S) {
    var FD = (PF * vd) / (100 * S);
    return FD;
  }

  function determineSegmentLOS(FD, Spl, vd, cap) {
    var LOS = '';
    if (Spl >= 50) {
      if (FD <= 2.0) LOS = 'A';
      else if (FD > 2.0 && FD <= 4.0) LOS = 'B';
      else if (FD > 4.0 && FD <= 8.0) LOS = 'C';
      else if (FD > 8.0 && FD <= 12.0) LOS = 'D';
      else if (FD > 12) LOS = 'E';
      if (vd > cap) LOS = 'F';
    } else {
      if (FD <= 2.5) LOS = 'A';
      else if (FD > 2.5 && FD <= 5.0) LOS = 'B';
      else if (FD > 5.0 && FD <= 10.0) LOS = 'C';
      else if (FD > 10.0 && FD <= 15.0) LOS = 'D';
      else if (FD > 15) LOS = 'E';
      if (vd > cap) LOS = 'F';
    }

    return LOS;
  }
</script>

<button class="btn" on:click={() => calculate(rows_len, rows)}>Calculate</button>
